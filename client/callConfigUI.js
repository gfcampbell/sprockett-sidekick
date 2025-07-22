// callConfigUI.js
// Sprint 4.0: Call Configuration UI Management
// Handles the pre-call configuration panel interactions and state management

import { USE_CASES, saveGoalToHistory, getGoalHistory, clearGoalHistory, saveCallConfig, loadCallConfig } from './callConfig.js';

// DOM element references
let useCaseSelect, goalInput, contextTextarea, aiPromptWaiting;
let goalHistoryBtn, goalHistoryDropdown, useCaseDescription;

// =============================================
// INITIALIZATION
// =============================================

/**
 * Initialize the call configuration UI
 * Sets up event listeners and loads saved configuration
 */
export const initializeCallConfigUI = () => {
    // Get DOM element references
    useCaseSelect = document.getElementById('use-case-select');
    goalInput = document.getElementById('goal-input');
    contextTextarea = document.getElementById('context-textarea');
    aiPromptWaiting = document.getElementById('ai-prompt-waiting');
    goalHistoryBtn = document.getElementById('goal-history-btn');
    goalHistoryDropdown = document.getElementById('goal-history-dropdown');
    useCaseDescription = document.getElementById('use-case-description');

    if (!useCaseSelect || !goalInput || !contextTextarea) {
        console.log('ℹ️ Call config UI elements not found - skipping initialization');
        return;
    }

    // Set up event listeners
    setupEventListeners();
    
    // Load saved configuration
    loadSavedConfiguration();
    
    console.log('✅ Call Configuration UI initialized');
};

/**
 * Set up all event listeners for the configuration UI
 */
const setupEventListeners = () => {
    // Use case selection
    useCaseSelect.addEventListener('change', handleUseCaseChange);
    
    // Goal input changes
    goalInput.addEventListener('input', handleGoalInput);
    goalInput.addEventListener('blur', handleGoalBlur);
    
    // Context textarea changes
    contextTextarea.addEventListener('input', handleContextInput);
    
    // Goal history button
    if (goalHistoryBtn) {
        goalHistoryBtn.addEventListener('click', toggleGoalHistory);
    }
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (goalHistoryDropdown && !goalHistoryDropdown.contains(e.target) && e.target !== goalHistoryBtn) {
            hideGoalHistory();
        }
    });
    
    // AI prompt changes (existing field)
    if (aiPromptWaiting) {
        aiPromptWaiting.addEventListener('input', handleAIPromptInput);
    }
};

// =============================================
// EVENT HANDLERS
// =============================================

/**
 * Handle use case selection change
 */
const handleUseCaseChange = () => {
    const selectedUseCase = useCaseSelect.value;
    
    // Update description
    if (useCaseDescription) {
        if (selectedUseCase && USE_CASES[selectedUseCase]) {
            useCaseDescription.textContent = USE_CASES[selectedUseCase].description;
            useCaseDescription.style.display = 'block';
        } else {
            useCaseDescription.style.display = 'none';
        }
    }
    
    // Update state and save
    updateCallConfigState();
};

/**
 * Handle goal input changes (real-time)
 */
const handleGoalInput = () => {
    updateCallConfigState();
};

/**
 * Handle goal input blur (save to history)
 */
const handleGoalBlur = () => {
    const goal = goalInput.value.trim();
    if (goal && goal.length >= 3) {
        saveGoalToHistory(goal);
    }
};

/**
 * Handle context textarea changes
 */
const handleContextInput = () => {
    updateCallConfigState();
};

/**
 * Handle AI prompt changes
 */
const handleAIPromptInput = () => {
    // This updates the existing userState.aiPrompt
    // The new system will combine this with the call config
    if (typeof window !== 'undefined' && window.userState) {
        window.userState.aiPrompt = aiPromptWaiting.value;
    }
};

// =============================================
// GOAL HISTORY MANAGEMENT
// =============================================

/**
 * Toggle the goal history dropdown
 */
const toggleGoalHistory = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (goalHistoryDropdown.style.display === 'block') {
        hideGoalHistory();
    } else {
        showGoalHistory();
    }
};

/**
 * Show the goal history dropdown
 */
const showGoalHistory = () => {
    const history = getGoalHistory();
    
    goalHistoryDropdown.innerHTML = '';
    
    if (history.length === 0) {
        const emptyItem = document.createElement('div');
        emptyItem.className = 'goal-history-empty';
        emptyItem.textContent = 'No previous goals';
        goalHistoryDropdown.appendChild(emptyItem);
    } else {
        history.forEach(goal => {
            const item = document.createElement('div');
            item.className = 'goal-history-item';
            
            const text = document.createElement('span');
            text.className = 'goal-history-item-text';
            text.textContent = goal;
            text.title = goal; // Show full text on hover
            
            const clearBtn = document.createElement('button');
            clearBtn.className = 'goal-history-clear';
            clearBtn.textContent = '×';
            clearBtn.title = 'Remove from history';
            
            item.appendChild(text);
            item.appendChild(clearBtn);
            
            // Click to select goal
            text.addEventListener('click', () => {
                goalInput.value = goal;
                updateCallConfigState();
                hideGoalHistory();
            });
            
            // Click to remove goal
            clearBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeGoalFromHistory(goal);
                showGoalHistory(); // Refresh dropdown
            });
            
            goalHistoryDropdown.appendChild(item);
        });
        
        // Add clear all button if there are items
        if (history.length > 1) {
            const clearAllItem = document.createElement('div');
            clearAllItem.className = 'goal-history-item';
            clearAllItem.style.borderTop = '1px solid var(--border-color)';
            clearAllItem.style.background = 'rgba(239, 68, 68, 0.05)';
            
            const clearAllText = document.createElement('span');
            clearAllText.textContent = 'Clear all history';
            clearAllText.style.color = 'var(--error-color)';
            clearAllText.style.fontWeight = '500';
            clearAllText.style.fontSize = '12px';
            
            clearAllItem.appendChild(clearAllText);
            
            clearAllItem.addEventListener('click', () => {
                clearGoalHistory();
                hideGoalHistory();
            });
            
            goalHistoryDropdown.appendChild(clearAllItem);
        }
    }
    
    goalHistoryDropdown.style.display = 'block';
};

/**
 * Hide the goal history dropdown
 */
const hideGoalHistory = () => {
    goalHistoryDropdown.style.display = 'none';
};

/**
 * Remove a specific goal from history
 */
const removeGoalFromHistory = (goalToRemove) => {
    const history = getGoalHistory();
    const updated = history.filter(goal => goal !== goalToRemove);
    localStorage.setItem('sprockett_goal_history', JSON.stringify(updated));
};

// =============================================
// STATE MANAGEMENT
// =============================================

/**
 * Update the call configuration state and save to localStorage
 */
const updateCallConfigState = () => {
    // Get current values
    const config = {
        useCase: useCaseSelect.value,
        goal: goalInput.value,
        context: contextTextarea.value
    };
    
    // Update the main app state if available
    if (typeof window !== 'undefined' && window.state && window.state.callConfig) {
        window.state.callConfig = config;
    }
    
    // Save to localStorage for persistence
    saveCallConfig(config);
    
    console.log('🔧 Call config updated:', config);
};

/**
 * Load saved configuration from localStorage
 */
const loadSavedConfiguration = () => {
    const saved = loadCallConfig();
    
    // Populate UI fields
    if (useCaseSelect && saved.useCase) {
        useCaseSelect.value = saved.useCase;
        handleUseCaseChange(); // Trigger description update
    }
    
    if (goalInput && saved.goal) {
        goalInput.value = saved.goal;
    }
    
    if (contextTextarea && saved.context) {
        contextTextarea.value = saved.context;
    }
    
    // Update state
    if (typeof window !== 'undefined' && window.state && window.state.callConfig) {
        window.state.callConfig = saved;
    }
    
    console.log('📁 Loaded saved call config:', saved);
};

// =============================================
// PUBLIC API
// =============================================

/**
 * Get the current call configuration
 * @returns {Object} Current call configuration
 */
export const getCurrentConfig = () => {
    return {
        useCase: useCaseSelect?.value || '',
        goal: goalInput?.value || '',
        context: contextTextarea?.value || ''
    };
};

/**
 * Reset the configuration form
 */
export const resetConfiguration = () => {
    if (useCaseSelect) useCaseSelect.value = '';
    if (goalInput) goalInput.value = '';
    if (contextTextarea) contextTextarea.value = '';
    if (aiPromptWaiting) aiPromptWaiting.value = '';
    if (useCaseDescription) useCaseDescription.style.display = 'none';
    
    updateCallConfigState();
};

/**
 * Set configuration programmatically
 * @param {Object} config - Configuration to set
 */
export const setConfiguration = (config) => {
    if (useCaseSelect && config.useCase) {
        useCaseSelect.value = config.useCase;
        handleUseCaseChange();
    }
    
    if (goalInput && config.goal) {
        goalInput.value = config.goal;
    }
    
    if (contextTextarea && config.context) {
        contextTextarea.value = config.context;
    }
    
    updateCallConfigState();
};

console.log('✅ Call Configuration UI module loaded'); 