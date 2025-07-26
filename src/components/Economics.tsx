import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

interface APIPricing {
  gpt4: { input: number; output: number }
  gpt35: { input: number; output: number }
  whisper: number
}

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
  const [showPricingConfig, setShowPricingConfig] = useState(false)
  const [apiPricing, setApiPricing] = useState<APIPricing>({
    gpt4: { input: 2.50, output: 10.00 },  // gpt-4o current pricing per 1M tokens
    gpt35: { input: 0.15, output: 0.60 },  // gpt-4o-mini current pricing per 1M tokens
    whisper: 0.006  // Whisper current pricing per minute
  })

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

      // Fetch revenue data from token transactions
      const { data: revenueData, error: revenueError } = await supabase
        .from('token_transactions')
        .select('tokens, amount_usd, transaction_type, created_at')
        .eq('transaction_type', 'purchase')
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

      // Fetch actual AI configuration for real frequency and token settings
      const { data: aiConfigData, error: aiConfigError } = await supabase
        .from('ai_config')
        .select('config_type, frequency_ms, max_tokens, is_active')
        .eq('is_active', true)

      if (aiConfigError) {
        throw new Error(`AI config query failed: ${aiConfigError.message}`)
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

      // Calculate costs based on real AI configuration and session data
      const costBreakdown = calculateLLMCosts(sessionData || [], usageData || [], aiConfigData || [])
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

  const calculateLLMCosts = (sessions: any[], _usage: any[], aiConfigs: any[]) => {
    // Use current API pricing from state (convert from per 1M to per 1 token)
    const PRICING = {
      gpt4: {
        input: apiPricing.gpt4.input / 1000000,   // Convert from per 1M to per 1 token
        output: apiPricing.gpt4.output / 1000000   // Convert from per 1M to per 1 token
      },
      gpt35: {
        input: apiPricing.gpt35.input / 1000000, // Convert from per 1M to per 1 token  
        output: apiPricing.gpt35.output / 1000000  // Convert from per 1M to per 1 token
      },
      whisper: apiPricing.whisper / 60     // Per minute
    }

    // Get actual AI configuration settings
    const coachingConfig = aiConfigs.find(config => config.config_type === 'coaching')
    const metricsConfig = aiConfigs.find(config => config.config_type === 'metrics')
    
    // Use real configuration or fallback to defaults
    const coachingFrequencyMs = coachingConfig?.frequency_ms || 15000 // Default 15 seconds
    const metricsFrequencyMs = metricsConfig?.frequency_ms || 60000   // Default 60 seconds
    const coachingTokens = coachingConfig?.max_tokens || 150          // From actual config
    const metricsTokens = metricsConfig?.max_tokens || 100            // From actual config

    let gpt4Costs = 0
    let gpt35Costs = 0
    let whisperCosts = 0
    let totalLLMCalls = 0

    // Calculate costs based on REAL session data and REAL AI configuration
    sessions.forEach(session => {
      if (session.start_time && session.end_time) {
        const durationMinutes = (new Date(session.end_time).getTime() - new Date(session.start_time).getTime()) / (1000 * 60)
        
        // Calculate calls based on ACTUAL configured frequencies
        const coachingCallsPerMinute = 60000 / coachingFrequencyMs  // Real frequency from config
        const metricsCallsPerMinute = 60000 / metricsFrequencyMs    // Real frequency from config
        
        const coachingCalls = Math.floor(durationMinutes * coachingCallsPerMinute)
        const metricsCalls = Math.floor(durationMinutes * metricsCallsPerMinute)
        
        // Use REAL token limits from configuration
        gpt4Costs += coachingCalls * coachingTokens * (PRICING.gpt4.input + PRICING.gpt4.output)
        gpt35Costs += metricsCalls * metricsTokens * (PRICING.gpt35.input + PRICING.gpt35.output)
        
        // Whisper transcription costs (per minute of audio)
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
          <div className="breakdown-header">
            <h3>Cost Breakdown</h3>
            <button 
              className="pricing-config-toggle"
              onClick={() => setShowPricingConfig(!showPricingConfig)}
              title="Configure API pricing"
            >
              <span className={`chevron ${showPricingConfig ? 'expanded' : ''}`}>▼</span>
              Pricing
            </button>
          </div>

          {showPricingConfig && (
            <div className="pricing-configurator">
              <h4>API Pricing Configuration</h4>
              
              <div className="pricing-row">
                <label>GPT-4 Input (per 1M tokens)</label>
                <input 
                  type="number" 
                  step="0.001" 
                  value={apiPricing.gpt4.input}
                  onChange={(e) => setApiPricing(prev => ({
                    ...prev,
                    gpt4: { ...prev.gpt4, input: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
              
              <div className="pricing-row">
                <label>GPT-4 Output (per 1M tokens)</label>
                <input 
                  type="number" 
                  step="0.001" 
                  value={apiPricing.gpt4.output}
                  onChange={(e) => setApiPricing(prev => ({
                    ...prev,
                    gpt4: { ...prev.gpt4, output: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
              
              <div className="pricing-row">
                <label>GPT-4o-mini Input (per 1M tokens)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  value={apiPricing.gpt35.input}
                  onChange={(e) => setApiPricing(prev => ({
                    ...prev,
                    gpt35: { ...prev.gpt35, input: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
              
              <div className="pricing-row">
                <label>GPT-4o-mini Output (per 1M tokens)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  value={apiPricing.gpt35.output}
                  onChange={(e) => setApiPricing(prev => ({
                    ...prev,
                    gpt35: { ...prev.gpt35, output: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
              
              <div className="pricing-row">
                <label>Whisper (per minute)</label>
                <input 
                  type="number" 
                  step="0.001" 
                  value={apiPricing.whisper}
                  onChange={(e) => setApiPricing(prev => ({
                    ...prev,
                    whisper: parseFloat(e.target.value) || 0
                  }))}
                />
              </div>
              
              <div className="pricing-actions">
                <button 
                  className="apply-pricing-btn"
                  onClick={fetchEconomicsData}
                >
                  Recalculate Costs
                </button>
              </div>
            </div>
          )}

          <div className="breakdown-item">
            <span>GPT-4o (Coaching)</span>
            <span>{formatCurrency(economicsData.costBreakdown.gpt4Costs)}</span>
          </div>
          <div className="breakdown-item">
            <span>GPT-4o-mini (Metrics)</span>
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