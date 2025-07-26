import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

interface SessionStats {
  totalSessions: number
  totalDuration: number
  totalTokensUsed: number
  avgSessionDuration: number
  activeUsers: number
  todaySessions: number
  weekSessions: number
}

interface SessionData {
  id: string
  user_id: string
  email: string
  start_time: string
  end_time: string
  duration_minutes: number
  tokens_used: number
  mode: string
}

interface DailyUsage {
  date: string
  sessions: number
  duration: number
  tokens: number
}

export default function SessionAnalytics() {
  const [stats, setStats] = useState<SessionStats | null>(null)
  const [recentSessions, setRecentSessions] = useState<SessionData[]>([])
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAnalytics()
  }, [])

  const fetchAnalytics = async () => {
    setLoading(true)
    setError(null)

    try {
      // Fetch overall stats
      const { data: sessions, error: sessionsError } = await supabase
        .from('call_sessions')
        .select(`
          id,
          user_id,
          start_time,
          end_time,
          mode,
          user_accounts!inner(email)
        `)
        .not('end_time', 'is', null)
        .order('start_time', { ascending: false })

      if (sessionsError) throw sessionsError

      // Fetch token usage
      const { data: tokenUsage, error: tokenError } = await supabase
        .from('token_usage')
        .select('tokens_used, timestamp, session_id')

      if (tokenError) throw tokenError

      // Process data
      const processedSessions = sessions?.map(session => {
        const startTime = new Date(session.start_time)
        const endTime = new Date(session.end_time)
        const durationMs = endTime.getTime() - startTime.getTime()
        const durationMinutes = Math.round(durationMs / (1000 * 60))
        
        const sessionTokens = tokenUsage?.filter(t => t.session_id === session.id)
          .reduce((sum, t) => sum + t.tokens_used, 0) || 0

        return {
          id: session.id,
          user_id: session.user_id,
          email: session.user_accounts?.email || 'Unknown',
          start_time: session.start_time,
          end_time: session.end_time,
          duration_minutes: durationMinutes,
          tokens_used: sessionTokens,
          mode: session.mode || 'video'
        }
      }) || []

      // Calculate stats
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)

      const totalDuration = processedSessions.reduce((sum, s) => sum + s.duration_minutes, 0)
      const totalTokens = processedSessions.reduce((sum, s) => sum + s.tokens_used, 0)
      const activeUsers = new Set(processedSessions.map(s => s.user_id)).size
      
      const todaySessions = processedSessions.filter(s => 
        new Date(s.start_time) >= today
      ).length

      const weekSessions = processedSessions.filter(s => 
        new Date(s.start_time) >= weekAgo
      ).length

      setStats({
        totalSessions: processedSessions.length,
        totalDuration,
        totalTokensUsed: totalTokens,
        avgSessionDuration: processedSessions.length > 0 ? Math.round(totalDuration / processedSessions.length) : 0,
        activeUsers,
        todaySessions,
        weekSessions
      })

      setRecentSessions(processedSessions.slice(0, 20))

      // Calculate daily usage for last 14 days
      const dailyData: { [key: string]: DailyUsage } = {}
      
      for (let i = 13; i >= 0; i--) {
        const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
        const dateStr = date.toISOString().split('T')[0]
        dailyData[dateStr] = {
          date: dateStr,
          sessions: 0,
          duration: 0,
          tokens: 0
        }
      }

      processedSessions.forEach(session => {
        const dateStr = session.start_time.split('T')[0]
        if (dailyData[dateStr]) {
          dailyData[dateStr].sessions++
          dailyData[dateStr].duration += session.duration_minutes
          dailyData[dateStr].tokens += session.tokens_used
        }
      })

      setDailyUsage(Object.values(dailyData))

    } catch (err) {
      setError(`Failed to fetch analytics: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
  }

  if (loading) {
    return <div className="loading">Loading session analytics...</div>
  }

  return (
    <div className="session-analytics">
      <div className="analytics-header">
        <h2>Session Analytics</h2>
        <button onClick={fetchAnalytics} className="refresh-btn">
          Refresh Data
        </button>
      </div>

      {error && (
        <div className="admin-error">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {stats && (
        <>
          {/* Overview Stats */}
          <div className="stats-grid">
            <div className="stat-card">
              <h3>Total Sessions</h3>
              <div className="stat-value">{stats.totalSessions}</div>
              <div className="stat-label">All time</div>
            </div>
            <div className="stat-card">
              <h3>Total Duration</h3>
              <div className="stat-value">{formatDuration(stats.totalDuration)}</div>
              <div className="stat-label">All sessions</div>
            </div>
            <div className="stat-card">
              <h3>Tokens Used</h3>
              <div className="stat-value">{stats.totalTokensUsed.toLocaleString()}</div>
              <div className="stat-label">Total consumed</div>
            </div>
            <div className="stat-card">
              <h3>Avg Duration</h3>
              <div className="stat-value">{formatDuration(stats.avgSessionDuration)}</div>
              <div className="stat-label">Per session</div>
            </div>
            <div className="stat-card">
              <h3>Active Users</h3>
              <div className="stat-value">{stats.activeUsers}</div>
              <div className="stat-label">With sessions</div>
            </div>
            <div className="stat-card">
              <h3>Today</h3>
              <div className="stat-value">{stats.todaySessions}</div>
              <div className="stat-label">Sessions</div>
            </div>
            <div className="stat-card">
              <h3>This Week</h3>
              <div className="stat-value">{stats.weekSessions}</div>
              <div className="stat-label">Sessions</div>
            </div>
          </div>

          {/* Daily Usage Chart */}
          <div className="chart-section">
            <h3>Daily Usage (Last 14 Days)</h3>
            <div className="daily-chart">
              {dailyUsage.map(day => (
                <div key={day.date} className="chart-bar">
                  <div 
                    className="bar-sessions" 
                    style={{height: `${Math.max(day.sessions * 10, 2)}px`}}
                    title={`${day.sessions} sessions`}
                  ></div>
                  <div className="bar-label">
                    {new Date(day.date).getDate()}
                  </div>
                  <div className="bar-info">
                    <div>{day.sessions} sessions</div>
                    <div>{formatDuration(day.duration)}</div>
                    <div>{day.tokens} tokens</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Sessions */}
          <div className="recent-sessions">
            <h3>Recent Sessions (Last 20)</h3>
            <div className="sessions-table">
              <div className="table-header">
                <div>User</div>
                <div>Start Time</div>
                <div>Duration</div>
                <div>Tokens</div>
                <div>Mode</div>
              </div>
              
              {recentSessions.map(session => (
                <div key={session.id} className="table-row">
                  <div className="session-user">{session.email}</div>
                  <div className="session-time">
                    {new Date(session.start_time).toLocaleString()}
                  </div>
                  <div className="session-duration">
                    {formatDuration(session.duration_minutes)}
                  </div>
                  <div className="session-tokens">{session.tokens_used}</div>
                  <div className="session-mode">{session.mode}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}