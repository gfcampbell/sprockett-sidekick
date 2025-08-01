# DISC Sales Intelligence System Architecture (Vercel + Supabase)

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DISC Sales Intelligence Platform                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Frontend (Vercel)           │  Backend (Vercel)          │  External APIs   │
│  ├── Next.js App             │  ├── API Routes            │  ├── Gong API    │
│  ├── Edge Functions          │  ├── Edge Functions        │  ├── OpenAI API  │
│  ├── Real-time UI            │  ├── Serverless Funcs      │  └── Claude API  │
│  └── Static Assets           │  └── Cron Jobs             │                  │
├──────────────────────────────┴────────────────────────────┴─────────────────┤
│                         Supabase Backend Services                            │
│  ├── PostgreSQL Database     ├── Realtime Subscriptions  ├── Edge Functions │
│  ├── Row Level Security      ├── Vector Embeddings       └── Storage        │
│  └── Auth                    └── Database Functions                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Tech Stack (Optimized for Vercel + Supabase)

### Frontend & Backend (Vercel)
- **Next.js 14+** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **shadcn/ui** for component library
- **Recharts** for data visualization
- **@supabase/ssr** for auth and real-time
- **React Query** with Supabase integration
- **Vercel Edge Functions** for low-latency APIs
- **Vercel Cron Jobs** for scheduled tasks

### Database & Backend Services (Supabase)
- **PostgreSQL** with pgvector extension
- **Supabase Realtime** for live updates
- **Supabase Auth** for authentication
- **Supabase Storage** for call recordings
- **Supabase Edge Functions** for complex logic
- **Row Level Security (RLS)** for data protection

### AI/ML Pipeline
- **OpenAI GPT-4** via Vercel Edge Functions
- **Claude 3** via Anthropic API
- **pgvector** for embeddings in Supabase
- **LangChain** for AI orchestration
- **Vercel AI SDK** for streaming responses

## Detailed Architecture Components

### 1. Database Schema (Supabase)

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Organizations table
CREATE TABLE organizations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  fiscalnote_products JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sales calls table with RLS
CREATE TABLE sales_calls (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  gong_call_id TEXT UNIQUE NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  participants JSONB NOT NULL,
  call_date TIMESTAMPTZ NOT NULL,
  duration_seconds INTEGER,
  outcome TEXT CHECK (outcome IN ('won', 'lost', 'ongoing', 'scheduled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transcript segments with vector embeddings
CREATE TABLE transcript_segments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  call_id UUID REFERENCES sales_calls(id) ON DELETE CASCADE,
  speaker_id TEXT NOT NULL,
  speaker_type TEXT CHECK (speaker_type IN ('prospect', 'sales_rep', 'other')),
  text TEXT NOT NULL,
  timestamp_ms INTEGER NOT NULL,
  disc_classification JSONB,
  confidence_score FLOAT CHECK (confidence_score >= 0 AND confidence_score <= 1),
  embedding vector(1536), -- OpenAI embeddings
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DISC profiles
CREATE TABLE disc_profiles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  call_id UUID REFERENCES sales_calls(id) ON DELETE CASCADE,
  participant_id TEXT NOT NULL,
  dominant_style TEXT CHECK (dominant_style IN ('D', 'I', 'S', 'C')),
  style_scores JSONB NOT NULL, -- {D: 0.7, I: 0.2, S: 0.05, C: 0.05}
  behavioral_indicators JSONB,
  confidence_level FLOAT CHECK (confidence_level >= 0 AND confidence_level <= 1),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(call_id, participant_id)
);

-- Sales recommendations
CREATE TABLE sales_recommendations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  call_id UUID REFERENCES sales_calls(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES disc_profiles(id) ON DELETE CASCADE,
  recommendation_type TEXT NOT NULL,
  content TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  context JSONB,
  is_applied BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Training data for DISC classifier
CREATE TABLE disc_training_data (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  statement TEXT NOT NULL,
  classification TEXT CHECK (classification IN ('D', 'I', 'S', 'C')),
  rationale TEXT,
  embedding vector(1536),
  is_validated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_transcript_segments_call_id ON transcript_segments(call_id);
CREATE INDEX idx_transcript_segments_embedding ON transcript_segments USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_disc_profiles_call_participant ON disc_profiles(call_id, participant_id);
CREATE INDEX idx_sales_recommendations_call_id ON sales_recommendations(call_id);

-- Enable Row Level Security
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcript_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE disc_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_recommendations ENABLE ROW LEVEL SECURITY;

-- RLS Policies (example for organizations)
CREATE POLICY "Users can view their own organization" ON organizations
  FOR SELECT USING (auth.uid() IN (
    SELECT user_id FROM organization_members WHERE organization_id = organizations.id
  ));
```

### 2. Supabase Edge Functions

```typescript
// supabase/functions/analyze-transcript/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { OpenAI } from "https://deno.land/x/openai/mod.ts"

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY')!,
})

serve(async (req) => {
  const { transcript_segment } = await req.json()
  
  // Generate embedding
  const embedding = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: transcript_segment.text,
  })
  
  // Find similar statements from training data
  const { data: similar } = await supabase.rpc('match_disc_statements', {
    query_embedding: embedding.data[0].embedding,
    match_threshold: 0.8,
    match_count: 5
  })
  
  // Classify using GPT-4
  const classification = await openai.chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [
      {
        role: "system",
        content: `You are a DISC personality classifier. Based on the statement and similar examples, classify it as D, I, S, or C.`
      },
      {
        role: "user",
        content: `Statement: "${transcript_segment.text}"\n\nSimilar examples: ${JSON.stringify(similar)}`
      }
    ],
    response_format: { type: "json_object" }
  })
  
  // Store results
  await supabase
    .from('transcript_segments')
    .update({
      disc_classification: classification.choices[0].message.content,
      embedding: embedding.data[0].embedding,
      confidence_score: 0.85 // Calculate based on similarity scores
    })
    .eq('id', transcript_segment.id)
  
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

### 3. Vercel API Routes

```typescript
// app/api/calls/analyze/route.ts
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge' // Use Vercel Edge Runtime

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  const { callId } = await request.json()
  
  // Fetch call data
  const { data: call } = await supabase
    .from('sales_calls')
    .select(`
      *,
      transcript_segments (*)
    `)
    .eq('id', callId)
    .single()
  
  // Process segments in parallel using Edge Functions
  const analyses = await Promise.all(
    call.transcript_segments.map(segment =>
      supabase.functions.invoke('analyze-transcript', {
        body: { transcript_segment: segment }
      })
    )
  )
  
  // Generate DISC profile
  const profile = await generateDISCProfile(call.transcript_segments)
  
  // Store profile
  await supabase
    .from('disc_profiles')
    .upsert(profile)
  
  return NextResponse.json({ profile })
}
```

### 4. Real-time Subscriptions

```typescript
// app/calls/[callId]/page.tsx
'use client'

import { createClient } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'

export default function CallAnalysisPage({ params }: { params: { callId: string } }) {
  const [segments, setSegments] = useState<TranscriptSegment[]>([])
  const [profile, setProfile] = useState<DISCProfile | null>(null)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  
  useEffect(() => {
    // Subscribe to real-time updates
    const channel = supabase
      .channel(`call-${params.callId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transcript_segments',
          filter: `call_id=eq.${params.callId}`
        },
        (payload) => {
          setSegments(prev => [...prev, payload.new as TranscriptSegment])
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'disc_profiles',
          filter: `call_id=eq.${params.callId}`
        },
        (payload) => {
          setProfile(payload.new as DISCProfile)
        }
      )
      .subscribe()
    
    return () => {
      supabase.removeChannel(channel)
    }
  }, [params.callId])
  
  return (
    <div className="grid grid-cols-3 gap-4">
      <TranscriptFeed segments={segments} />
      <DISCProfileCard profile={profile} />
      <RecommendationsPanel callId={params.callId} profile={profile} />
    </div>
  )
}
```

### 5. Vercel Cron Jobs

```typescript
// app/api/cron/sync-gong/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'edge'

// Vercel Cron: "0 */15 * * *" (every 15 minutes)
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  
  // Fetch recent Gong calls
  const gongCalls = await fetchRecentGongCalls()
  
  // Process new calls
  for (const gongCall of gongCalls) {
    // Check if already processed
    const { data: existing } = await supabase
      .from('sales_calls')
      .select('id')
      .eq('gong_call_id', gongCall.id)
      .single()
    
    if (!existing) {
      // Create new call record
      await supabase
        .from('sales_calls')
        .insert({
          gong_call_id: gongCall.id,
          participants: gongCall.participants,
          call_date: gongCall.date,
          duration_seconds: gongCall.duration
        })
      
      // Trigger async processing
      await fetch(`${process.env.VERCEL_URL}/api/calls/process`, {
        method: 'POST',
        body: JSON.stringify({ gongCallId: gongCall.id })
      })
    }
  }
  
  return NextResponse.json({ processed: gongCalls.length })
}
```

### 6. Authentication with Supabase Auth

```typescript
// app/layout.tsx
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )
  
  const { data: { session } } = await supabase.auth.getSession()
  
  return (
    <html>
      <body>
        <SupabaseProvider session={session}>
          {children}
        </SupabaseProvider>
      </body>
    </html>
  )
}
```

### 7. Vector Search for Similar Statements

```sql
-- Supabase SQL function for vector similarity search
CREATE OR REPLACE FUNCTION match_disc_statements(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  statement text,
  classification text,
  rationale text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    disc_training_data.id,
    disc_training_data.statement,
    disc_training_data.classification,
    disc_training_data.rationale,
    1 - (disc_training_data.embedding <=> query_embedding) as similarity
  FROM disc_training_data
  WHERE 1 - (disc_training_data.embedding <=> query_embedding) > match_threshold
  ORDER BY disc_training_data.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

### 8. Performance Optimization with Vercel

```typescript
// next.config.js
module.exports = {
  experimental: {
    ppr: true, // Partial Prerendering
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
}

// Use ISR for dashboard pages
// app/dashboard/page.tsx
export const revalidate = 60 // Revalidate every minute

// Use streaming for AI responses
// app/api/ai/recommend/route.ts
import { OpenAIStream, StreamingTextResponse } from 'ai'

export async function POST(req: Request) {
  const { messages } = await req.json()
  
  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    stream: true,
    messages,
  })
  
  const stream = OpenAIStream(response)
  return new StreamingTextResponse(stream)
}
```

### 9. Monitoring and Analytics

```typescript
// lib/analytics.ts
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'

// Track custom events
export function trackDISCClassification(
  classification: string,
  confidence: number
) {
  if (window.gtag) {
    window.gtag('event', 'disc_classification', {
      classification,
      confidence,
    })
  }
}

// Supabase function to track usage
CREATE OR REPLACE FUNCTION track_api_usage(
  endpoint text,
  user_id uuid,
  response_time_ms int
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO api_usage_logs (endpoint, user_id, response_time_ms)
  VALUES (endpoint, user_id, response_time_ms);
END;
$$;
```

### 10. Environment Variables

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT_ID].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Vercel Environment Variables
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GONG_API_KEY=your-gong-key
CRON_SECRET=your-cron-secret
VERCEL_URL=$VERCEL_URL
```

## Key Advantages of Vercel + Supabase

1. **Simplified Infrastructure**
   - No Kubernetes/Docker management
   - Automatic scaling with Vercel
   - Built-in database with Supabase

2. **Real-time Capabilities**
   - Supabase Realtime for live updates
   - No need for separate WebSocket server
   - Built-in presence tracking

3. **Edge Performance**
   - Vercel Edge Functions for low latency
   - Global CDN for static assets
   - Edge caching for API responses

4. **Developer Experience**
   - Local development with Supabase CLI
   - Vercel preview deployments
   - Integrated monitoring and analytics

5. **Cost Optimization**
   - Pay-per-use pricing
   - No idle server costs
   - Efficient resource utilization

## Implementation Timeline

### Week 1-2: Foundation
- Set up Vercel + Supabase projects
- Implement database schema
- Basic authentication flow
- Gong webhook integration

### Week 3-4: Core Features
- DISC classification pipeline
- Real-time transcript processing
- Basic dashboard UI
- Initial recommendations

### Week 5-6: Enhancement
- Vector similarity search
- Advanced AI integration
- Real-time updates
- Performance optimization

### Week 7-8: Polish
- Complete UI/UX
- Testing and debugging
- Documentation
- Initial deployment