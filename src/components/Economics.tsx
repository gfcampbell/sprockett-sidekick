import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

interface EconomicsData {
  totalRevenue: number
  totalCosts: number
  netProfit: number
  profitMargin: number
  revenueBreakdown: {
    tokenPurchases: number
    transactionCount: number
  }
  costBreakdown: {
    gpt4Costs: number
    gpt35Costs: number
    whisperCosts: number
    totalLLMCalls: number
  }
  periodData: {
    startDate: string
    endDate: string
    days: number
  }
}

export default function Economics() {
  const [economicsData, setEconomicsData] = useState<EconomicsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d')

  useEffect(() => {
    fetchEconomicsData()
  }, [timeRange])

  const getDateRange = () => {
    const endDate = new Date()
    let startDate = new Date()
    
    switch (timeRange) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7)
        break
      case '30d':
        startDate.setDate(endDate.getDate() - 30)
        break
      case '90d':
        startDate.setDate(endDate.getDate() - 90)
        break
      case 'all':
        startDate = new Date('2024-01-01') // Project start date
        break
    }
    
    return { startDate, endDate }
  }

  const fetchEconomicsData = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const { startDate, endDate } = getDateRange()
      const startDateStr = startDate.toISOString()
      const endDateStr = endDate.toISOString()

      // Fetch revenue data from tokens ledger
      const { data: revenueData, error: revenueError } = await supabase
        .from('tokens_ledger')
        .select('*')
        .gte('created_at', startDateStr)
        .lte('created_at', endDateStr)

      if (revenueError) {
        throw new Error(`Revenue query failed: ${revenueError.message}`)
      }

      // Fetch session data for cost estimation
      const { data: sessionData, error: sessionError } = await supabase
        .from('call_sessions')
        .select('id, start_time, end_time, mode, created_at')
        .gte('created_at', startDateStr)
        .lte('created_at', endDateStr)

      if (sessionError) {
        throw new Error(`Session query failed: ${sessionError.message}`)
      }

      // Fetch token usage for detailed cost calculation
      const { data: usageData, error: usageError } = await supabase
        .from('token_usage')
        .select('tokens_used, timestamp, mode, duration_seconds')
        .gte('timestamp', startDateStr)
        .lte('timestamp', endDateStr)

      if (usageError) {
        throw new Error(`Usage query failed: ${usageError.message}`)
      }

      // Calculate revenue
      const totalRevenue = revenueData?.reduce((sum, transaction) => 
        sum + (transaction.amount_usd || 0), 0) || 0
      const transactionCount = revenueData?.length || 0

      // Estimate costs based on real usage patterns
      const costBreakdown = calculateLLMCosts(sessionData || [], usageData || [])
      const totalCosts = costBreakdown.gpt4Costs + costBreakdown.gpt35Costs + costBreakdown.whisperCosts

      // Calculate profit metrics
      const netProfit = totalRevenue - totalCosts
      const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

      const economics: EconomicsData = {
        totalRevenue,
        totalCosts,
        netProfit,
        profitMargin,
        revenueBreakdown: {
          tokenPurchases: totalRevenue,
          transactionCount
        },
        costBreakdown,
        periodData: {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          days: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
        }
      }

      setEconomicsData(economics)
    } catch (err) {
      setError(`Failed to fetch economics data: ${err}`)
      console.error('Economics data fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  const calculateLLMCosts = (sessions: any[], _usage: any[]) => {
    // Real cost estimates based on OpenAI pricing (as of 2024)
    const PRICING = {
      gpt4: {
        input: 0.03 / 1000,   // $0.03 per 1K input tokens
        output: 0.06 / 1000   // $0.06 per 1K output tokens
      },
      gpt35: {
        input: 0.0015 / 1000, // $0.0015 per 1K input tokens  
        output: 0.002 / 1000  // $0.002 per 1K output tokens
      },
      whisper: 0.006 / 60     // $0.006 per minute
    }

    let gpt4Costs = 0
    let gpt35Costs = 0
    let whisperCosts = 0
    let totalLLMCalls = 0

    // Estimate costs from session duration and usage patterns
    sessions.forEach(session => {
      if (session.start_time && session.end_time) {
        const durationMinutes = (new Date(session.end_time).getTime() - new Date(session.start_time).getTime()) / (1000 * 60)
        
        // Estimate coaching calls (GPT-4) - typically every 15 seconds during active sessions
        const coachingCalls = Math.floor(durationMinutes * 4) // 4 calls per minute
        const avgCoachingTokens = 150 // Average tokens per coaching call (input + output)
        gpt4Costs += coachingCalls * avgCoachingTokens * (PRICING.gpt4.input + PRICING.gpt4.output)
        
        // Estimate metrics calls (GPT-3.5) - typically every 60 seconds
        const metricsCalls = Math.floor(durationMinutes) // 1 call per minute
        const avgMetricsTokens = 100 // Average tokens per metrics call
        gpt35Costs += metricsCalls * avgMetricsTokens * (PRICING.gpt35.input + PRICING.gpt35.output)
        
        // Estimate transcription costs (Whisper) - charged per minute
        whisperCosts += durationMinutes * PRICING.whisper
        
        totalLLMCalls += coachingCalls + metricsCalls
      }
    })

    return {
      gpt4Costs: Math.round(gpt4Costs * 100) / 100,
      gpt35Costs: Math.round(gpt35Costs * 100) / 100, 
      whisperCosts: Math.round(whisperCosts * 100) / 100,
      totalLLMCalls
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount)
  }

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
  }

  if (loading) {
    return (
      <div className="economics-loading">
        <div className="loading-spinner"></div>
        <p>Loading economics data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="economics-error">
        <h3>Error Loading Economics Data</h3>
        <p>{error}</p>
        <button onClick={fetchEconomicsData} className="retry-button">
          Retry
        </button>
      </div>
    )
  }

  if (!economicsData) {
    return (
      <div className="economics-empty">
        <h3>No Economics Data Available</h3>
        <p>No revenue or cost data found for the selected period.</p>
      </div>
    )
  }

  return (
    <div className="economics-dashboard">
      <div className="economics-header">
        <h2>Economics Dashboard</h2>
        <div className="time-range-selector">
          {(['7d', '30d', '90d', 'all'] as const).map(range => (
            <button
              key={range}
              className={`time-range-btn ${timeRange === range ? 'active' : ''}`}
              onClick={() => setTimeRange(range)}
            >
              {range === 'all' ? 'All Time' : range.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="period-info">
        <p>
          Period: {economicsData.periodData.startDate} to {economicsData.periodData.endDate} 
          ({economicsData.periodData.days} days)
        </p>
      </div>

      {/* Key Metrics Cards */}
      <div className="economics-cards">
        <div className="economics-card revenue">
          <div className="card-header">
            <h3>Total Revenue</h3>
            <span className="card-icon">💰</span>
          </div>
          <div className="card-value">{formatCurrency(economicsData.totalRevenue)}</div>
          <div className="card-subtitle">
            {economicsData.revenueBreakdown.transactionCount} transactions
          </div>
        </div>

        <div className="economics-card costs">
          <div className="card-header">
            <h3>Total Costs</h3>
            <span className="card-icon">🔧</span>
          </div>
          <div className="card-value">{formatCurrency(economicsData.totalCosts)}</div>
          <div className="card-subtitle">
            {economicsData.costBreakdown.totalLLMCalls} LLM calls
          </div>
        </div>

        <div className={`economics-card profit ${economicsData.netProfit >= 0 ? 'positive' : 'negative'}`}>
          <div className="card-header">
            <h3>Net Profit</h3>
            <span className="card-icon">{economicsData.netProfit >= 0 ? '📈' : '📉'}</span>
          </div>
          <div className="card-value">{formatCurrency(economicsData.netProfit)}</div>
          <div className="card-subtitle">
            {formatPercentage(economicsData.profitMargin)} margin
          </div>
        </div>
      </div>

      {/* Detailed Breakdown */}
      <div className="economics-breakdown">
        <div className="breakdown-section">
          <h3>Revenue Breakdown</h3>
          <div className="breakdown-item">
            <span>Token Purchases</span>
            <span>{formatCurrency(economicsData.revenueBreakdown.tokenPurchases)}</span>
          </div>
        </div>

        <div className="breakdown-section">
          <h3>Cost Breakdown</h3>
          <div className="breakdown-item">
            <span>GPT-4 (Coaching)</span>
            <span>{formatCurrency(economicsData.costBreakdown.gpt4Costs)}</span>
          </div>
          <div className="breakdown-item">
            <span>GPT-3.5 (Metrics)</span>
            <span>{formatCurrency(economicsData.costBreakdown.gpt35Costs)}</span>
          </div>
          <div className="breakdown-item">
            <span>Whisper (Transcription)</span>
            <span>{formatCurrency(economicsData.costBreakdown.whisperCosts)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}