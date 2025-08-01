# Product Requirements Document (PRD)
# DISC Sales Intelligence System for FiscalNote

**Version:** 1.0  
**Date:** January 2024  
**Author:** Product Team  
**Status:** Draft

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Product Overview](#product-overview)
3. [Problem Statement](#problem-statement)
4. [Goals and Objectives](#goals-and-objectives)
5. [User Personas](#user-personas)
6. [User Stories and Requirements](#user-stories-and-requirements)
7. [Feature Specifications](#feature-specifications)
8. [User Interface Design](#user-interface-design)
9. [Technical Requirements](#technical-requirements)
10. [Data Model](#data-model)
11. [Integration Requirements](#integration-requirements)
12. [Security and Compliance](#security-and-compliance)
13. [Performance Requirements](#performance-requirements)
14. [Success Metrics](#success-metrics)
15. [Release Plan](#release-plan)
16. [Risks and Mitigation](#risks-and-mitigation)
17. [Appendices](#appendices)

---

## 1. Executive Summary

The DISC Sales Intelligence System is an AI-powered platform that analyzes sales conversations from Gong to identify customer personality types using the DISC framework (Dominance, Influence, Steadiness, Conscientiousness). The system provides real-time recommendations to sales representatives, enabling them to adapt their communication style and improve conversion rates for FiscalNote's suite of policy intelligence products.

### Key Value Propositions
- **Increase win rates** by 25-40% through personality-adapted selling
- **Reduce sales cycle length** by understanding decision-making styles
- **Improve customer satisfaction** through personalized interactions
- **Scale best practices** across the entire sales organization

---

## 2. Product Overview

### 2.1 Product Vision
Empower every FiscalNote sales representative with AI-driven personality insights that transform how they connect with and sell to government affairs professionals, lobbyists, and policy teams.

### 2.2 Product Mission
Build an intelligent system that seamlessly integrates with existing sales workflows to provide actionable, real-time guidance based on proven behavioral science, specifically tailored for selling policy intelligence and government relations solutions.

### 2.3 Target Market
- **Primary:** FiscalNote sales teams (50+ reps)
- **Secondary:** Customer Success Managers
- **Future:** Partner channel sales teams

### 2.4 Core Capabilities
1. **Real-time DISC Analysis:** Classify customer personality types during live calls
2. **Contextual Recommendations:** Provide talking points specific to FiscalNote products
3. **Historical Intelligence:** Track personality patterns across multiple interactions
4. **Team Analytics:** Aggregate insights for sales leadership
5. **Performance Tracking:** Measure recommendation effectiveness

---

## 3. Problem Statement

### 3.1 Current Challenges

**For Sales Representatives:**
- Difficulty adapting communication style to different customer personalities
- Inconsistent messaging across team members
- Limited visibility into what resonates with specific customer types
- Reactive rather than proactive conversation management

**For Sales Leadership:**
- Lack of data-driven insights into conversation dynamics
- Inability to scale successful communication patterns
- No systematic way to coach based on customer personality types
- Difficulty measuring soft skill improvements

**For Customers:**
- Generic sales approaches that don't match their communication preferences
- Frustration with misaligned sales tactics
- Longer decision cycles due to communication friction

### 3.2 Market Context
Government affairs and policy professionals have distinct communication patterns:
- **D-types:** C-suite executives needing quick ROI demonstrations
- **I-types:** Relationship-driven lobbyists valuing success stories
- **S-types:** Risk-averse compliance officers requiring stability
- **C-types:** Data-driven policy analysts demanding detailed specifications

### 3.3 Competitive Landscape
Current solutions (Gong, Chorus) provide conversation intelligence but lack:
- Personality-based analysis and recommendations
- Industry-specific insights for government relations
- Real-time adaptation guidance
- FiscalNote product-specific coaching

---

## 4. Goals and Objectives

### 4.1 Business Goals
1. **Increase Revenue:** Improve win rate by 25% within 6 months
2. **Accelerate Sales Cycles:** Reduce average cycle time by 20%
3. **Improve Efficiency:** Decrease ramp time for new reps by 30%
4. **Enhance Customer Experience:** Achieve 4.5+ CSAT scores

### 4.2 Product Objectives
1. **Accuracy:** Achieve 85%+ DISC classification accuracy
2. **Adoption:** 80% daily active usage by sales team
3. **Speed:** <500ms real-time classification latency
4. **Value:** 4.5/5 average usefulness rating for recommendations

### 4.3 Success Criteria
- Measurable improvement in conversion rates for DISC-aligned conversations
- Positive correlation between recommendation usage and deal closure
- Reduction in customer objections related to communication style
- Increased confidence scores from sales team surveys

---

## 5. User Personas

### 5.1 Primary Persona: Sarah Chen - Enterprise Sales Rep

**Background:**
- 3 years selling FiscalNote solutions
- Manages 20-30 enterprise accounts
- Strong product knowledge, developing soft skills
- Tech-savvy, embraces new tools

**Goals:**
- Close larger deals faster
- Build stronger customer relationships
- Differentiate from competitors
- Earn President's Club

**Pain Points:**
- Struggles with C-suite executives (D-types)
- Difficulty reading customer personalities
- Inconsistent talk track adaptation
- Limited coaching on soft skills

**Needs from System:**
- Real-time guidance during calls
- Pre-call personality insights
- Post-call coaching recommendations
- Success pattern examples

### 5.2 Secondary Persona: Marcus Williams - Sales Manager

**Background:**
- Managing team of 8 reps
- Former top performer
- Data-driven coaching approach
- Focused on team development

**Goals:**
- Improve team's average win rate
- Standardize best practices
- Provide better coaching
- Identify skill gaps

**Pain Points:**
- Limited visibility into conversation dynamics
- Difficulty scaling coaching
- Subjective performance assessments
- Time-consuming call reviews

**Needs from System:**
- Team performance dashboards
- Conversation quality metrics
- Coaching recommendation engine
- Pattern identification tools

### 5.3 Tertiary Persona: Jennifer Park - Customer Success Manager

**Background:**
- Manages post-sale relationships
- 5 years in government relations
- Relationship-focused approach
- Advocates for customer needs

**Goals:**
- Increase retention rates
- Improve product adoption
- Anticipate customer needs
- Smooth renewals

**Pain Points:**
- Inheriting relationships without context
- Misaligned communication from sales
- Limited personality insights
- Reactive issue management

**Needs from System:**
- Historical personality profiles
- Handoff intelligence from sales
- Relationship management tips
- Communication style guide

---

## 6. User Stories and Requirements

### 6.1 Epic: Real-time Call Intelligence

**User Story 1.1:** As a sales rep, I want to see real-time DISC classification of my prospect during calls so that I can adapt my communication style immediately.

**Acceptance Criteria:**
- DISC indicator appears within 2 minutes of call start
- Classification updates every 30 seconds based on new statements
- Confidence score displayed (low/medium/high)
- Visual indicators are non-intrusive
- Works with Gong's live call interface

**User Story 1.2:** As a sales rep, I want to receive contextual talking points based on the prospect's DISC type so that I can respond more effectively.

**Acceptance Criteria:**
- Recommendations appear within 500ms of classification
- Tips are specific to FiscalNote products mentioned
- Maximum 3 recommendations shown at once
- Can dismiss/pin recommendations
- Recommendations consider conversation stage

**User Story 1.3:** As a sales rep, I want to see which statements triggered specific DISC classifications so that I can better understand the analysis.

**Acceptance Criteria:**
- Clickable DISC indicator shows triggering statements
- Highlights key phrases that influenced classification
- Shows classification rationale
- Timestamp linked to call recording
- Exportable for training purposes

### 6.2 Epic: Pre-Call Preparation

**User Story 2.1:** As a sales rep, I want to review historical DISC profiles before calls so that I can prepare my approach.

**Acceptance Criteria:**
- Dashboard shows all previous interactions
- Aggregate DISC profile across all calls
- Key behavioral patterns highlighted
- Suggested opening approaches
- Links to successful similar conversations

**User Story 2.2:** As a sales rep, I want AI-generated pre-call briefs based on participant DISC profiles so that I can optimize my strategy.

**Acceptance Criteria:**
- Brief generated 24 hours before scheduled call
- Includes recommended agenda structure
- Suggests materials to emphasize
- Provides specific FiscalNote product positioning
- Identifies potential objections by DISC type

### 6.3 Epic: Post-Call Analysis

**User Story 3.1:** As a sales rep, I want detailed post-call DISC analysis so that I can improve for future interactions.

**Acceptance Criteria:**
- Complete conversation breakdown by DISC moments
- Effectiveness scoring of responses
- Missed opportunity identification
- Improvement recommendations
- Comparison to successful similar calls

**User Story 3.2:** As a sales manager, I want team-wide DISC performance analytics so that I can identify coaching opportunities.

**Acceptance Criteria:**
- Team dashboard with DISC distribution
- Success rates by DISC type
- Individual rep strengths/weaknesses
- Trend analysis over time
- Exportable reports for reviews

### 6.4 Epic: Learning and Development

**User Story 4.1:** As a new sales rep, I want interactive DISC training modules so that I can quickly learn to identify personality types.

**Acceptance Criteria:**
- Interactive quiz with real call examples
- Scenario-based practice sessions
- Personalized learning path
- Progress tracking
- Certification upon completion

**User Story 4.2:** As a sales rep, I want to see examples of successful interactions with each DISC type so that I can model effective behaviors.

**Acceptance Criteria:**
- Searchable library of call snippets
- Filtered by DISC type and outcome
- Annotated with key techniques
- Side-by-side comparison views
- Bookmark favorite examples

---

## 7. Feature Specifications

### 7.1 Core Features

#### 7.1.1 Real-time DISC Classifier
**Description:** AI-powered analysis engine that processes speech patterns, word choice, and conversation dynamics to identify DISC personality types in real-time.

**Functional Requirements:**
- Process audio transcription stream from Gong
- Analyze each speaker utterance for DISC indicators
- Maintain running confidence score
- Support multiple participants per call
- Handle interruptions and crosstalk

**Technical Specifications:**
- OpenAI GPT-4 for natural language understanding
- Custom fine-tuned classifier on FiscalNote-specific data
- Vector embeddings for pattern matching
- Edge computing for <500ms latency
- WebSocket integration for live updates

#### 7.1.2 Dynamic Recommendation Engine
**Description:** Context-aware system that generates personalized recommendations based on DISC profile, conversation stage, and FiscalNote products discussed.

**Functional Requirements:**
- Generate recommendations within 500ms
- Consider current conversation context
- Adapt to multiple DISC types in group calls
- Prioritize recommendations by impact
- Track recommendation usage and effectiveness

**Technical Specifications:**
- Claude 3 for nuanced recommendation generation
- Retrieval-augmented generation (RAG) with success patterns
- Product-specific recommendation database
- A/B testing framework for optimization
- Feedback loop for continuous improvement

#### 7.1.3 Conversation Intelligence Dashboard
**Description:** Comprehensive analytics platform providing insights at individual, team, and organization levels.

**Functional Requirements:**
- Real-time call monitoring
- Historical conversation analysis
- Team performance metrics
- DISC distribution reports
- Coaching recommendations

**UI Components:**
- Live call monitor with DISC indicators
- Performance scorecards
- Trend visualizations
- Comparative analytics
- Export capabilities

#### 7.1.4 Pre-Call Intelligence Briefs
**Description:** AI-generated preparation documents that synthesize historical interactions and recommend call strategies.

**Functional Requirements:**
- Aggregate historical DISC data
- Generate call objectives based on personality
- Suggest talking points and materials
- Identify potential objections
- Provide success pattern examples

**Delivery Methods:**
- Email 24 hours before call
- In-app notification
- Calendar integration
- Mobile push notification
- Slack message

### 7.2 Advanced Features

#### 7.2.1 Multi-Modal Analysis
**Description:** Enhance DISC classification using video feeds, tone analysis, and linguistic patterns.

**Components:**
- Facial expression analysis
- Voice tone and pace detection
- Linguistic complexity scoring
- Emotional state recognition
- Cultural adaptation layer

#### 7.2.2 Predictive Deal Intelligence
**Description:** Use DISC patterns to predict deal outcomes and suggest interventions.

**Capabilities:**
- Win probability scoring
- Risk identification
- Intervention recommendations
- Optimal next steps
- Champion identification

#### 7.2.3 Team Collaboration Tools
**Description:** Enable knowledge sharing and best practice distribution across sales team.

**Features:**
- Shared DISC profiles
- Success story repository
- Peer coaching tools
- Team challenges/gamification
- Best practice automation

---

## 8. User Interface Design

### 8.1 Design Principles
1. **Non-Intrusive:** Enhance, don't distract from natural conversation
2. **Actionable:** Every element should drive specific behavior
3. **Intuitive:** Zero training required for basic usage
4. **Responsive:** Adapt to different screen sizes and contexts
5. **Accessible:** WCAG 2.1 AA compliance

### 8.2 Information Architecture

```
Home Dashboard
├── Active Calls (Live Monitoring)
├── Upcoming Calls
│   ├── Pre-Call Briefs
│   └── Historical Profiles
├── Analytics
│   ├── Personal Performance
│   ├── Team Insights
│   └── DISC Distribution
├── Call Library
│   ├── Recent Calls
│   ├── Successful Examples
│   └── Training Clips
└── Settings
    ├── Preferences
    ├── Integrations
    └── Notifications
```

### 8.3 Key UI Components

#### 8.3.1 Live Call Interface
```
┌─────────────────────────────────────────────────────┐
│ [Gong Logo] Active Call with Acme Corp             │
├─────────────────────────────────────────────────────┤
│                                                     │
│  John Smith (Prospect)                              │
│  ┌─────────────┐  Confidence: ████████░░ 78%      │
│  │      D      │  Speaking: "We need results fast" │
│  │    72%      │  Last update: 2 seconds ago       │
│  └─────────────┘                                   │
│                                                     │
│  💡 Recommendations                    [Pin] [Hide] │
│  ├─ Focus on ROI and implementation speed          │
│  ├─ Share Fortune 500 success metrics              │
│  └─ Offer exclusive PolicyNote features            │
│                                                     │
│  📊 Call Stats     ⏱️ 12:34    👥 3 participants   │
└─────────────────────────────────────────────────────┘
```

#### 8.3.2 DISC Profile Card
```
┌─────────────────────────────────────────────────────┐
│ Contact: Jennifer Williams                          │
│ Company: Global Policy Associates                   │
├─────────────────────────────────────────────────────┤
│           DISC Profile (5 interactions)             │
│                                                     │
│    D         I         S         C                  │
│   ░░░      ████      ████       ░░                 │
│   15%       42%       38%        5%                │
│                                                     │
│ Primary: Influence (I)                              │
│ Secondary: Steadiness (S)                           │
├─────────────────────────────────────────────────────┤
│ Key Behaviors:                                      │
│ • Enthusiastic about innovation                     │
│ • Values team consensus                             │
│ • Prefers gradual implementation                    │
│                                                     │
│ Recommended Approach:                               │
│ • Start with success stories                        │
│ • Emphasize team benefits                           │
│ • Propose phased rollout                            │
└─────────────────────────────────────────────────────┘
```

#### 8.3.3 Analytics Dashboard
```
┌─────────────────────────────────────────────────────┐
│ Your DISC Performance         Last 30 Days         │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Win Rate by DISC Type                              │
│  D: ████████████ 67%  ↑12%                        │
│  I: ████████████████ 78%  ↑5%                     │
│  S: ████████ 45%  ↓8%                             │
│  C: ██████████ 56%  →0%                           │
│                                                     │
│  Recommendations Used: 234/312 (75%)                │
│  Average Confidence Score: 82%                      │
│                                                     │
│  [View Detailed Report]  [Export Data]              │
└─────────────────────────────────────────────────────┘
```

### 8.4 Mobile Experience
- Responsive design for tablet use during calls
- Mobile app for pre-call brief review
- Push notifications for insights
- Offline mode for brief access
- Voice-activated commands

---

## 9. Technical Requirements

### 9.1 Architecture Overview
- **Frontend:** Next.js 14 with TypeScript
- **Backend:** Vercel Edge Functions
- **Database:** Supabase (PostgreSQL with pgvector)
- **AI/ML:** OpenAI GPT-4, Claude 3, Custom models
- **Real-time:** Supabase Realtime subscriptions
- **Analytics:** Vercel Analytics, Custom metrics

### 9.2 Performance Requirements
- **Page Load:** <2 seconds (P95)
- **Classification Latency:** <500ms
- **Recommendation Generation:** <1 second
- **Real-time Updates:** <100ms delay
- **Availability:** 99.9% uptime

### 9.3 Scalability Requirements
- Support 100+ concurrent users
- Process 1000+ calls daily
- Store 1M+ transcript segments
- Handle 10K API requests/minute
- Auto-scale based on demand

### 9.4 Browser Support
- Chrome 90+ (primary)
- Safari 14+
- Firefox 88+
- Edge 90+
- Mobile Safari/Chrome

---

## 10. Data Model

### 10.1 Core Entities

#### Organizations
```typescript
interface Organization {
  id: UUID
  name: string
  fiscalnote_products: string[]
  subscription_tier: 'starter' | 'professional' | 'enterprise'
  created_at: Date
  settings: {
    disc_model_version: string
    recommendation_preferences: object
  }
}
```

#### Sales Calls
```typescript
interface SalesCall {
  id: UUID
  gong_call_id: string
  organization_id: UUID
  participants: Participant[]
  call_date: Date
  duration_seconds: number
  outcome: 'won' | 'lost' | 'ongoing' | 'scheduled'
  products_discussed: string[]
  next_steps: string
  transcript_status: 'pending' | 'processing' | 'completed'
}
```

#### DISC Profiles
```typescript
interface DISCProfile {
  id: UUID
  call_id: UUID
  participant_id: string
  dominant_style: 'D' | 'I' | 'S' | 'C'
  style_scores: {
    D: number // 0-1
    I: number
    S: number
    C: number
  }
  behavioral_indicators: {
    communication_pace: 'fast' | 'moderate' | 'slow'
    decision_style: 'quick' | 'collaborative' | 'analytical'
    risk_tolerance: 'high' | 'medium' | 'low'
    detail_orientation: 'big_picture' | 'balanced' | 'detail_focused'
  }
  confidence_level: number
  key_statements: Statement[]
}
```

### 10.2 Data Privacy
- All transcript data encrypted at rest
- PII redaction in stored transcripts
- Role-based access control
- Audit logging for all data access
- GDPR-compliant data retention

---

## 11. Integration Requirements

### 11.1 Gong Integration
**Requirements:**
- OAuth 2.0 authentication
- Webhook for new call notifications
- REST API for transcript retrieval
- WebSocket for live transcription
- Bulk export for historical data

**Data Flow:**
1. Webhook notification of new call
2. Authenticate and retrieve call metadata
3. Subscribe to live transcription stream
4. Process and store transcript segments
5. Update Gong with insights (optional)

### 11.2 Salesforce Integration
**Requirements:**
- Sync contact and account data
- Update opportunity fields with DISC data
- Create activities for significant insights
- Custom fields for DISC profiles
- Bulk sync every 6 hours

### 11.3 Slack Integration
**Features:**
- Daily DISC performance summaries
- Pre-call brief notifications
- Win/loss alerts with DISC context
- Team performance updates
- Coaching tip of the day

### 11.4 Calendar Integration
**Features:**
- Auto-detect upcoming calls
- Add DISC brief to calendar events
- Color-code meetings by DISC type
- Reminder notifications
- Post-call follow-up scheduling

---

## 12. Security and Compliance

### 12.1 Security Requirements
- **Encryption:** TLS 1.3 in transit, AES-256 at rest
- **Authentication:** SAML 2.0 SSO, MFA required
- **Authorization:** Role-based access control (RBAC)
- **Audit:** Complete audit trail of all actions
- **Vulnerability:** Quarterly penetration testing

### 12.2 Compliance Standards
- **SOC 2 Type II** certification
- **GDPR** compliance for EU data
- **CCPA** compliance for California
- **HIPAA** ready (future healthcare sales)
- **ISO 27001** certification roadmap

### 12.3 Data Governance
- Customer data isolation
- Right to deletion (GDPR Article 17)
- Data portability (GDPR Article 20)
- Consent management
- Privacy by design principles

---

## 13. Performance Requirements

### 13.1 System Performance
| Metric | Target | Critical Threshold |
|--------|--------|-------------------|
| API Response Time | <200ms (P50) | <500ms (P95) |
| Page Load Time | <1s | <3s |
| Classification Accuracy | >85% | >75% |
| Uptime | 99.9% | 99.5% |
| Concurrent Users | 200 | 100 |

### 13.2 AI Model Performance
| Model | Accuracy Target | Latency Target |
|-------|----------------|----------------|
| DISC Classifier | 85% | <300ms |
| Recommendation Engine | 80% relevance | <1s |
| Pre-call Brief Generator | 90% usefulness | <5s |
| Sentiment Analysis | 88% | <200ms |

### 13.3 Data Processing
- Ingest 10,000 calls/day
- Process 1M transcript segments/day
- Generate 50,000 recommendations/day
- Store 365 days of data
- Real-time processing lag <2s

---

## 14. Success Metrics

### 14.1 Business Metrics
| Metric | Baseline | 3-Month Target | 6-Month Target |
|--------|----------|----------------|----------------|
| Win Rate | 24% | 28% | 30% |
| Sales Cycle Length | 92 days | 82 days | 74 days |
| ACV (Annual Contract Value) | $85K | $95K | $105K |
| Rep Ramp Time | 120 days | 100 days | 84 days |

### 14.2 Product Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Daily Active Users | 80% | Unique daily logins |
| Feature Adoption | 75% | Reps using recommendations |
| Classification Accuracy | 85% | Manual validation sample |
| Recommendation CTR | 40% | Clicks/impressions |
| User Satisfaction | 4.5/5 | Monthly NPS survey |

### 14.3 Operational Metrics
- Mean Time to Classification: <2 minutes
- System Availability: 99.9%
- Support Ticket Volume: <5% of users/month
- Data Processing Lag: <5 minutes
- Cost per Call Analysis: <$0.50

---

## 15. Release Plan

### 15.1 MVP (Version 1.0) - Week 8
**Features:**
- Basic DISC classification
- Simple recommendations
- Gong integration
- Core dashboard
- Individual performance metrics

**Success Criteria:**
- 70% classification accuracy
- 50% user adoption
- Positive user feedback

### 15.2 Version 1.1 - Week 12
**Features:**
- Real-time classification
- Enhanced recommendations
- Pre-call briefs
- Team analytics
- Salesforce integration

**Success Criteria:**
- 80% classification accuracy
- 70% user adoption
- Measurable win rate improvement

### 15.3 Version 2.0 - Week 20
**Features:**
- Multi-modal analysis
- Predictive insights
- Advanced coaching tools
- Mobile app
- Partner portal

**Success Criteria:**
- 85% classification accuracy
- 80% user adoption
- 25% win rate improvement

### 15.4 Future Roadmap
- Voice-activated coaching
- AR/VR training modules
- Cross-language support
- Industry-specific models
- Autonomous follow-up

---

## 16. Risks and Mitigation

### 16.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| AI model accuracy below target | Medium | High | Continuous training, human validation |
| Gong API limitations | Low | High | Build abstraction layer, multi-provider support |
| Real-time processing delays | Medium | Medium | Edge computing, caching strategies |
| Data privacy concerns | Low | Critical | Strong encryption, compliance audits |

### 16.2 Business Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Low user adoption | Medium | High | Change management, training program |
| Competitor copying features | High | Medium | Rapid innovation, patent filing |
| Over-reliance on AI | Medium | Medium | Human-in-the-loop design |
| Customer privacy objections | Low | High | Opt-in model, transparency |

### 16.3 Operational Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Key personnel departure | Medium | High | Knowledge documentation, redundancy |
| Vendor dependency | Medium | Medium | Multi-vendor strategy |
| Scaling challenges | Low | Medium | Cloud-native architecture |
| Support overwhelm | Medium | Low | Self-service resources |

---

## 17. Appendices

### Appendix A: DISC Framework Reference

#### Dominance (D)
- **Characteristics:** Direct, results-oriented, decisive, competitive
- **Communication Style:** Brief, to the point, focused on outcomes
- **Decision Making:** Quick, independent, risk-tolerant
- **FiscalNote Pitch:** ROI, competitive advantage, exclusive features

#### Influence (I)
- **Characteristics:** Enthusiastic, optimistic, collaborative, people-focused
- **Communication Style:** Expressive, storytelling, relationship-building
- **Decision Making:** Emotionally-driven, seeks consensus, influenced by others
- **FiscalNote Pitch:** Success stories, innovation, team benefits

#### Steadiness (S)
- **Characteristics:** Patient, stable, supportive, team-oriented
- **Communication Style:** Calm, thorough, seeks harmony
- **Decision Making:** Cautious, needs time, values security
- **FiscalNote Pitch:** Reliability, support, gradual implementation

#### Conscientiousness (C)
- **Characteristics:** Analytical, precise, systematic, quality-focused
- **Communication Style:** Detailed, logical, data-driven
- **Decision Making:** Research-based, needs evidence, risk-averse
- **FiscalNote Pitch:** Data accuracy, methodology, compliance

### Appendix B: Competitive Analysis

| Feature | Our System | Gong | Chorus | Salesforce Einstein |
|---------|------------|------|--------|-------------------|
| DISC Analysis | ✅ Real-time | ❌ | ❌ | ❌ |
| Personality Insights | ✅ Detailed | ⚠️ Basic | ⚠️ Basic | ❌ |
| Live Recommendations | ✅ | ⚠️ Generic | ❌ | ❌ |
| Gov Relations Focus | ✅ | ❌ | ❌ | ❌ |
| Pre-call Intelligence | ✅ | ✅ | ✅ | ⚠️ |

### Appendix C: Sample Recommendations by DISC Type

#### For D-Type Prospects:
1. "Lead with bottom-line impact - mention 40% faster policy tracking"
2. "Offer exclusive beta access to new PolicyNote features"
3. "Schedule follow-up with C-suite decision maker"

#### For I-Type Prospects:
1. "Share success story from similar organization"
2. "Emphasize how PolicyNote enhances their team's reputation"
3. "Suggest collaborative implementation workshop"

#### For S-Type Prospects:
1. "Propose phased rollout starting with pilot team"
2. "Highlight 24/7 support and training resources"
3. "Offer references from long-term stable clients"

#### For C-Type Prospects:
1. "Provide detailed technical documentation"
2. "Share accuracy metrics and methodology whitepaper"
3. "Offer technical deep-dive with product team"

### Appendix D: Technical Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    User Interface                        │
│                 (Next.js on Vercel)                     │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│                   API Gateway                            │
│              (Vercel Edge Functions)                     │
└─────────────────────┬───────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┬─────────────────────┐
        │                           │                      │
┌───────▼────────┐  ┌──────────────▼──────┐  ┌───────────▼──────┐
│ Classification │  │  Recommendation     │  │   Analytics      │
│    Service     │  │     Engine          │  │    Service       │
└────────────────┘  └───────────────────────┘  └──────────────────┘
        │                           │                      │
        └─────────────┬─────────────┴──────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│                    Supabase                              │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │ PostgreSQL   │  │  Realtime    │  │ Vector Store  │ │
│  │  + pgvector  │  │ Subscriptions│  │  (Embeddings) │ │
│  └──────────────┘  └──────────────┘  └───────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Appendix E: Data Flow Diagram

```
Gong Call Initiated
        │
        ▼
Webhook Notification ──────► Vercel Edge Function
        │                            │
        ▼                            ▼
Live Transcript Stream         Store Call Metadata
        │                            │
        ▼                            ▼
Process Segments ────────► DISC Classification
        │                            │
        ▼                            ▼
Generate Embeddings ─────► Find Similar Patterns
        │                            │
        ▼                            ▼
Update UI in Real-time ◄─── Generate Recommendations
        │                            │
        ▼                            ▼
Track User Actions ──────► Measure Effectiveness
        │                            │
        ▼                            ▼
Post-Call Analysis ──────► Update Success Patterns
```

### Appendix F: Sample API Documentation

#### POST /api/classify
Classify a transcript segment for DISC personality type

**Request:**
```json
{
  "segment_id": "seg_123456",
  "text": "We need to see results quickly",
  "speaker_id": "spk_789",
  "call_id": "call_456",
  "timestamp_ms": 125000
}
```

**Response:**
```json
{
  "classification": {
    "dominant": "D",
    "scores": {
      "D": 0.78,
      "I": 0.12,
      "S": 0.07,
      "C": 0.03
    },
    "confidence": 0.85,
    "indicators": [
      "urgency_language",
      "results_focus",
      "directive_tone"
    ]
  },
  "recommendations": [
    {
      "id": "rec_001",
      "type": "talking_point",
      "content": "Emphasize rapid implementation timeline",
      "priority": 1
    }
  ]
}
```

### Appendix G: Glossary

- **DISC:** Dominance, Influence, Steadiness, Conscientiousness personality framework
- **Classification Confidence:** Statistical certainty of personality type assignment
- **Behavioral Indicator:** Specific action or phrase revealing personality traits
- **Talk Track:** Prepared messaging adapted to personality type
- **Win Rate:** Percentage of opportunities that result in closed-won deals
- **Sales Cycle:** Time from first contact to deal closure
- **ACV:** Annual Contract Value of a deal
- **Ramp Time:** Time for new rep to reach full productivity

---

**Document Control:**
- Version: 1.0
- Last Updated: January 2024
- Next Review: March 2024
- Owner: Product Management
- Stakeholders: Sales, Engineering, Customer Success, Executive Team