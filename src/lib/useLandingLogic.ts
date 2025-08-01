
const LANDING_SEEN_KEY = 'sprockett_landing_seen';
const LANDING_CONFIG_KEY = 'landing_page_config';

interface LandingPageConfig {
  enabled: boolean;
  redirect_url: string;
  bypass_param: string;
  test_mode: boolean;
}

export function useLandingLogic() {
  const hasSeenLanding = () => {
    return localStorage.getItem(LANDING_SEEN_KEY) === 'true';
  };

  const markLandingSeen = () => {
    localStorage.setItem(LANDING_SEEN_KEY, 'true');
  };

  const clearLandingSeen = () => {
    localStorage.removeItem(LANDING_SEEN_KEY);
  };

  const getLandingConfig = (): LandingPageConfig => {
    const saved = localStorage.getItem(LANDING_CONFIG_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (error) {
        console.error('Failed to parse landing page config:', error);
      }
    }
    
    // Default configuration
    return {
      enabled: false,
      redirect_url: '/landing',
      bypass_param: 'skip_landing',
      test_mode: false
    };
  };

  const shouldRedirectToLanding = (isAdmin: boolean = false): boolean => {
    const config = getLandingConfig();
    
    // Landing page redirect is disabled
    if (!config.enabled) return false;
    
    // Check if user has bypass parameter
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has(config.bypass_param)) return false;
    
    // User has already seen landing page
    if (hasSeenLanding()) return false;
    
    // If test mode is enabled, only redirect admins
    if (config.test_mode && !isAdmin) return false;
    
    // Don't redirect if already on landing page
    if (window.location.pathname.startsWith('/landing')) return false;
    
    // Don't redirect deep links (other than root)
    if (window.location.pathname !== '/') return false;
    
    return true;
  };

  const redirectToLanding = () => {
    const config = getLandingConfig();
    window.location.href = config.redirect_url;
  };

  return {
    hasSeenLanding,
    markLandingSeen,
    clearLandingSeen,
    getLandingConfig,
    shouldRedirectToLanding,
    redirectToLanding
  };
}