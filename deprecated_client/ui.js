// ui.js
// User interface interactions and media device management
// This file handles all UI state changes, device management, and user interactions

import { endSession } from './sessionLogger.js';
import { initializeAuth, signIn, signOut, setupAuthUI } from './auth.js';
import { initializeCallConfigUI } from './callConfigUI.js';

let landingPageContainer; // Added for new landing page structure

// 🆕 PHASE 1: Explicit DOM element declarations (fixes strict mode compliance)
// These variables were previously implicit globals causing "roomCreatedScreen is not defined" error
let roomCreatedScreen, videoChatScreen, createRoomBtn, roomLinkInput, copyLinkBtn, 
    localVideoPreview, localVideo, remoteVideo, localVideoContainer, toggleVideoBtn, 
    toggleAudioBtn, toggleDevicesBtn, shareScreenBtn, endCallBtn, deviceSelection, 
    videoSource, audioSource, audioOutput, messageElement, tutorialOverlay, 
    tutorialCloseBtn, statusMessage, statusPopup, statusPopupMessage, statusPopupClose, 
    previewVideoSource;

// Show diagnostic popup
const showDiagnostic = (message) => {
    statusPopupMessage.textContent = message;
    statusPopup.style.display = 'block';
};

// Hide address bar
window.addEventListener("load", () => {
    // Scroll the page by 1 pixel to hide the address bar
    setTimeout(() => {
        window.scrollTo(0, 1);
    }, 0);
});

// Media control functions
const toggleVideo = () => {
    if (state.localStream) {
        const videoTracks = state.localStream.getVideoTracks();
        if (videoTracks.length > 0) {
            const enabled = !videoTracks[0].enabled;
            videoTracks[0].enabled = enabled;
            state.isVideoMuted = !enabled;

            toggleVideoBtn.classList.toggle('muted', !enabled);
            showMessage(enabled ? 'Camera turned on' : 'Camera turned off', 'success');
        }
    }
};

const toggleAudio = () => {
    if (state.localStream) {
        const audioTracks = state.localStream.getAudioTracks();
        if (audioTracks.length > 0) {
            const enabled = !audioTracks[0].enabled;
            audioTracks[0].enabled = enabled;
            state.isAudioMuted = !enabled;

            toggleAudioBtn.classList.toggle('muted', !enabled);
            showMessage(enabled ? 'Microphone unmuted' : 'Microphone muted', 'success');
        }
    }
};

const toggleDeviceSelection = () => {
    state.deviceSelectionVisible = !state.deviceSelectionVisible;
    deviceSelection.style.display = state.deviceSelectionVisible ? 'block' : 'none';
    toggleDevicesBtn.classList.toggle('active', state.deviceSelectionVisible);

    if (state.deviceSelectionVisible) {
        loadAvailableDevices();
    }
};

// Screen sharing with improved error handling
const toggleScreenShare = async () => {
    try {
        if (!state.isScreenSharing) {
            // Check if getDisplayMedia is supported
            if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
                throw new Error("Your browser doesn't support screen sharing. Please try Chrome, Firefox, or Safari.");
            }

            // Start screen sharing
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: false
            });

            // Save reference to screen stream
            state.screenStream = screenStream;

            // Replace video track in the peer connection
            const videoTrack = screenStream.getVideoTracks()[0];

            if (state.peerConnection) {
                const senders = state.peerConnection.getSenders();
                const videoSender = senders.find(sender =>
                    sender.track && sender.track.kind === 'video'
                );

                if (videoSender) {
                    videoSender.replaceTrack(videoTrack);
                }
            }

            // Show screen share in local video
            localVideo.srcObject = screenStream;

            // Set flag
            state.isScreenSharing = true;
            shareScreenBtn.classList.add('active');
            showMessage('Screen sharing started', 'success');

            // Handle the case when user stops screen sharing via browser UI
            videoTrack.onended = () => {
                stopScreenSharing();
            };
        } else {
            stopScreenSharing();
        }
    } catch (error) {
        console.error('Error sharing screen:', error);
        if (error.name === 'NotAllowedError') {
            showMessage('Screen sharing permission denied', 'error');
        } else {
            showMessage(`Could not share screen: ${error.message}`, 'error');
        }
    }
};

// Stop screen sharing with robust error handling
const stopScreenSharing = () => {
    if (state.screenStream) {
        console.log('Stopping screen sharing and cleaning up resources');

        try {
            // Stop all tracks in the screen stream
            const tracks = state.screenStream.getTracks();
            console.log(`Stopping ${tracks.length} screen sharing tracks`);

            for (const track of tracks) {
                try {
                    track.stop();
                    console.log(`Stopped screen sharing ${track.kind} track: ${track.id}`);
                } catch (trackError) {
                    console.error(`Error stopping screen sharing ${track.kind} track:`, trackError);
                }
            }

            // Replace with camera video track in the peer connection if in a call
            if (state.peerConnection && state.localStream) {
                const videoTrack = state.localStream.getVideoTracks()[0];
                if (videoTrack) {
                    console.log('Replacing screen sharing track with camera track in peer connection');
                    const senders = state.peerConnection.getSenders();
                    const videoSender = senders.find(sender =>
                        sender.track && sender.track.kind === 'video'
                    );

                    if (videoSender) {
                        videoSender.replaceTrack(videoTrack);
                    }
                }
            }

            // Check if localVideo is displaying the screen stream and restore it
            if (localVideo.srcObject === state.screenStream) {
                console.log('Restoring local video display');
                localVideo.srcObject = state.localStream;
            }

            // Clear any event listeners on the tracks
            for (const track of tracks) {
                track.onended = null;
            }

            // Reset state
            state.screenStream = null;
            state.isScreenSharing = false;
            shareScreenBtn.classList.remove('active');
            showMessage('Screen sharing stopped', 'success');
        } catch (error) {
            console.error('Error during screen sharing cleanup:', error);
            showMessage('Error stopping screen sharing', 'error');

            // Emergency cleanup
            try {
                if (state.screenStream) {
                    for (const track of state.screenStream.getTracks()) {
                        track.stop();
                    }
                    state.screenStream = null;
                }
                state.isScreenSharing = false;
                shareScreenBtn.classList.remove('active');

                // Restore local video anyway
                if (state.localStream) {
                    localVideo.srcObject = state.localStream;
                }
            } catch (emergencyError) {
                console.error('Emergency screen sharing cleanup failed:', emergencyError);
            }
        }
    }
};

const endCall = () => {
    if (state.socket && state.roomId) {
        // 🆕 END SESSION LOGGING
        if (state.currentSessionId) {
            endSession(state.currentSessionId, state.peerConnection)
                .then(success => {
                    if (success) {
                        console.log(`📊 Session ended: ${state.currentSessionId}`);
                    }
                    state.currentSessionId = null;
                })
                .catch(error => {
                    console.error('❌ Failed to end session tracking:', error);
                    state.currentSessionId = null;
                });
        }

        // Return to root domain immediately
        window.history.replaceState({}, '', '/');
        
        // Signal others
        state.socket.emit('burn-room', { roomId: state.roomId });
        
        // Clean up local state
        window.cleanupAndReset();
    }
};

const loadAvailableDevices = async () => {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();

        // Group devices by kind
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        const audioDevices = devices.filter(device => device.kind === 'audioinput');
        const audioOutputDevices = devices.filter(device => device.kind === 'audiooutput');

        // Remember current selections
        const currentVideoId = videoSource.value;
        const currentAudioId = audioSource.value;
        const currentOutputId = audioOutput.value;
        const currentPreviewId = previewVideoSource.value;

        // Clear select elements
        videoSource.innerHTML = '';
        audioSource.innerHTML = '';
        audioOutput.innerHTML = '';
        previewVideoSource.innerHTML = '';

        // Add video devices
        if (videoDevices.length > 0) {
            for (const device of videoDevices) {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.text = device.label || `Camera ${videoSource.options.length + 1}`;
                videoSource.appendChild(option);

                // Also add to preview select
                const previewOption = document.createElement('option');
                previewOption.value = device.deviceId;
                previewOption.text = device.label || `Camera ${previewVideoSource.options.length + 1}`;
                previewVideoSource.appendChild(previewOption);
            }

            // Restore selection if it exists in the new list
            if (currentVideoId && [...videoSource.options].some(opt => opt.value === currentVideoId)) {
                videoSource.value = currentVideoId;
            }

            if (currentPreviewId && [...previewVideoSource.options].some(opt => opt.value === currentPreviewId)) {
                previewVideoSource.value = currentPreviewId;
            }
        } else {
            const option = document.createElement('option');
            option.text = 'No cameras available';
            videoSource.appendChild(option);

            const previewOption = document.createElement('option');
            previewOption.text = 'No cameras available';
            previewVideoSource.appendChild(previewOption);
        }

        // Add audio devices
        if (audioDevices.length > 0) {
            for (const device of audioDevices) {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.text = device.label || `Microphone ${audioSource.options.length + 1}`;
                audioSource.appendChild(option);
            }

            // Restore selection if it exists in the new list
            if (currentAudioId && [...audioSource.options].some(opt => opt.value === currentAudioId)) {
                audioSource.value = currentAudioId;
            }
        } else {
            const option = document.createElement('option');
            option.text = 'No microphones available';
            audioSource.appendChild(option);
        }

        // Add audio output devices (if supported)
        if (typeof HTMLMediaElement.prototype.setSinkId === 'function') {
            if (audioOutputDevices.length > 0) {
                for (const device of audioOutputDevices) {
                    const option = document.createElement('option');
                    option.value = device.deviceId;
                    option.text = device.label || `Speaker ${audioOutput.options.length + 1}`;
                    audioOutput.appendChild(option);
                }

                // Restore selection if it exists in the new list
                if (currentOutputId && [...audioOutput.options].some(opt => opt.value === currentOutputId)) {
                    audioOutput.value = currentOutputId;
                }
            } else {
                const option = document.createElement('option');
                option.text = 'No speakers available';
                audioOutput.appendChild(option);
            }
        } else {
            const option = document.createElement('option');
            option.text = 'Output selection not supported';
            audioOutput.disabled = true;
            audioOutput.appendChild(option);
        }
    } catch (error) {
        console.error('Error loading devices:', error);
        showMessage('Could not retrieve device list', 'error');
    }
};

const changeVideoDevice = async () => {
    const currentVideoId = videoSource.value;
    try {
        const newDeviceId = videoSource.value;
        if (!newDeviceId) return;

        // Use template literal
        showMessage(`Switching camera to ${videoSource.options[videoSource.selectedIndex].text}...`, 'info');

        // Get new stream with the selected device
        const newStream = await navigator.mediaDevices.getUserMedia({ 
            video: { deviceId: { exact: newDeviceId } },
            audio: false // Keep audio unchanged
        });

        const newVideoTrack = newStream.getVideoTracks()[0];

        // Stop the old video track from the original stream
        if (state.localStream) {
            // Use for...of loop
            for (const track of state.localStream.getVideoTracks()) {
                track.stop();
                state.localStream.removeTrack(track);
            }
            // Add the new video track to the existing stream
            state.localStream.addTrack(newVideoTrack);
        } else {
            // If no localStream exists yet, create one (should ideally not happen here)
            state.localStream = newStream;
        }

        // Update local video element source
        localVideo.srcObject = state.localStream;

        // Update the track in the peer connection if it exists
        if (state.peerConnection) {
            const sender = state.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
            if (sender) {
                await sender.replaceTrack(newVideoTrack);
            }
        }

        showMessage('Camera changed successfully', 'success');
    } catch (error) {
        console.error('Error changing video device:', error);
        showMessage(`Could not change camera: ${error.message}`, 'error');
        // Restore previous selection
        videoSource.value = currentVideoId;
    }
};

const changeAudioDevice = async () => {
    const currentAudioId = audioSource.value;
    try {
        const newDeviceId = audioSource.value;
        if (!newDeviceId) return;

        // Use template literal
        showMessage(`Switching microphone to ${audioSource.options[audioSource.selectedIndex].text}...`, 'info');

        // Get new stream with the selected device
        const newStream = await navigator.mediaDevices.getUserMedia({
            video: false, // Keep video unchanged
            audio: { deviceId: { exact: newDeviceId } }
        });

        const newAudioTrack = newStream.getAudioTracks()[0];

        // Stop the old audio track from the original stream
        if (state.localStream) {
            // Use for...of loop
            for (const track of state.localStream.getAudioTracks()) {
                track.stop();
                state.localStream.removeTrack(track);
            }
            // Add the new audio track to the existing stream
            state.localStream.addTrack(newAudioTrack);
        } else {
            // If no localStream exists yet, create one (should ideally not happen here)
            state.localStream = newStream;
        }

        // Update the track in the peer connection if it exists
        if (state.peerConnection) {
            const sender = state.peerConnection.getSenders().find(s => s.track && s.track.kind === 'audio');
            if (sender) {
                await sender.replaceTrack(newAudioTrack);
            }
        }

        showMessage('Microphone changed successfully', 'success');
    } catch (error) {
        console.error('Error changing audio device:', error);
        showMessage(`Could not change microphone: ${error.message}`, 'error');
        // Restore previous selection
        audioSource.value = currentAudioId;
    }
};

const changeAudioOutput = async () => {
    try {
        const newDeviceId = audioOutput.value;
        if (!newDeviceId) return;

        // Check if setSinkId is supported
        if (typeof remoteVideo.setSinkId === 'function') {
            await remoteVideo.setSinkId(newDeviceId);
            // Use template literal
            showMessage(`Audio output set to ${audioOutput.options[audioOutput.selectedIndex].text}`, 'success');
        } else {
            showMessage('Changing audio output device is not supported by your browser.', 'warning');
        }
    } catch (error) {
        console.error('Error changing audio output:', error);
        showMessage(`Could not change audio output: ${error.message}`, 'error');
    }
};

const changePreviewVideoDevice = async () => {
    try {
        const newDeviceId = previewVideoSource.value;
        if (!newDeviceId) return;
        
        showMessage(`Switching preview camera to ${previewVideoSource.options[previewVideoSource.selectedIndex].text}...`, 'info');

        // Stop existing tracks if a preview stream is already running
        if (state.localPreviewStream) {
            // Use for...of loop
            for (const track of state.localPreviewStream.getTracks()) {
                 track.stop();
            }
        }

        // Get the new stream
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: newDeviceId } },
            audio: false // Don't need audio for preview
        });
        state.localPreviewStream = stream;
        localVideoPreview.srcObject = stream;

        showMessage('Preview camera updated', 'success');

    } catch (error) {
        console.error('Error changing preview camera:', error);
        showMessage(`Could not change preview camera: ${error.message}`, 'error');
    }
};

// =============================================
// SCREEN MANAGEMENT
// =============================================

/**
 * Switches between different screens (welcome, room-created, video-chat)
 * Handles hiding all other screens and showing the requested one
 * 
 * @param {HTMLElement} screen - The screen element to show
 */
const switchToScreen = (screen) => {
    try {
        // Hide all screens
        if (landingPageContainer) landingPageContainer.style.display = 'none'; 
        if (roomCreatedScreen) roomCreatedScreen.style.display = 'none';
        if (videoChatScreen) videoChatScreen.style.display = 'none';

        // Show the requested screen
        if (screen) {
            screen.style.display = 'block';
        } else {
            console.warn('Attempted to switch to undefined screen, defaulting to landing page');
            if (landingPageContainer) landingPageContainer.style.display = 'block'; 
        }

        // Add this condition to load devices when showing room-created screen
        if (screen === roomCreatedScreen) {
            try {
                loadAvailableDevices();
            } catch (error) {
                console.error('Error loading devices when switching screens:', error);
                showMessage('Could not load device list', 'warning');
            }
        }

        // Special handling for video chat screen (reset video container position)
        if (screen === videoChatScreen && localVideoContainer) { 
            // Reset local video position
            localVideoContainer.style.top = '20px'; // Adjust if needed
            localVideoContainer.style.left = '20px'; 
            localVideoContainer.style.right = 'auto'; 
        }
    } catch (error) {
        console.error('Error switching screens:', error);
        if (landingPageContainer) landingPageContainer.style.display = 'block'; 
    }
};

const showMessage = (text, type = 'success') => {
    try {
        // Use local variables instead of reassigning parameters
        let messageText = text;
        let messageType = type;

        // Validate inputs
        if (!messageText) {
            console.warn('Empty message text provided to showMessage');
            messageText = 'An action was completed';
        }

        if (!['success', 'warning', 'error'].includes(messageType)) {
            console.warn(`Invalid message type: ${messageType}, defaulting to success`);
            messageType = 'success';
        }

        // Show message using local variables
        messageElement.textContent = messageText;
        messageElement.className = `message ${messageType}`;
        messageElement.style.display = 'block';

        // Log messages to console for debugging
        if (messageType === 'error') {
            console.error(`UI Message: ${messageText}`);
        } else if (messageType === 'warning') {
            console.warn(`UI Message: ${messageText}`);
        } else {
            console.log(`UI Message: ${messageText}`);
        }
    } catch (error) {
        // Last resort error handling if the UI messaging system itself fails
        console.error('Error showing message:', error, 'Original message was:', text);
    }
};

const updateConnectionStatus = (connected) => {
    try {
        state.isConnected = connected;
        console.log('Connection status updated:', connected ? 'Connected' : 'Disconnected');
    } catch (error) {
        console.error('Error updating connection status:', error);
    }
};

const copyRoomLink = async () => {
    try {
        // Check if it's a mobile device using the same media query that changes the button text
        const isMobile = window.matchMedia('(max-width: 768px)').matches;
        const roomLink = roomLinkInput.value;

        // For mobile devices, try to use the Web Share API first
        if (isMobile && navigator.share) {
            try {
                await navigator.share({
                    title: 'Join my Oblivn video call',
                    text: 'Click this link to join my private video call:',
                    url: roomLink
                });
                showMessage('Link shared successfully!', 'success');
                return;
            } catch (shareError) {
                console.error('Error sharing link:', shareError);
                // If user cancels share, don't show error, just fall through to clipboard methods
                if (shareError.name !== 'AbortError') {
                    showMessage('Could not share link. Trying to copy instead...', 'warning');
                }
                // Fall through to clipboard methods
            }
        }

        // Try to use the Clipboard API
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(roomLink);
            showMessage('Room link copied to clipboard!', 'success');
            return;
        }

        // Fallback to older methods if Clipboard API is not available
        fallbackCopy();
    } catch (error) {
        console.error('Error copying link:', error);

        // Try fallback method
        fallbackCopy();
    }

    // Fallback copy method
    function fallbackCopy() {
        // Make input temporarily visible
        const originalDisplay = roomLinkInput.style.display;
        roomLinkInput.style.display = 'block';
        
        // Select the text
        roomLinkInput.select();
        roomLinkInput.setSelectionRange(0, 99999); // For mobile

        // Try to execute copy command
        try {
            const successful = document.execCommand('copy');
            if (successful) {
                showMessage('Room link copied to clipboard!', 'success');
            } else {
                showMessage('Please copy the link manually', 'warning');
                // Select it again for easier manual copying
                roomLinkInput.select();
            }
        } catch (err) {
            console.error('Fallback copy failed:', err);
            showMessage('Please copy the link manually', 'warning');
            // Select it again for easier manual copying
            roomLinkInput.select();
        } finally {
            // Restore original display setting
            roomLinkInput.style.display = originalDisplay;
        }
    }
};

const showTutorial = () => {
    tutorialOverlay.style.display = 'flex';
};

const closeTutorial = () => {
    tutorialOverlay.style.display = 'none';
    localStorage.setItem('tutorialShown', 'true');
};

const checkFirstTimeVisitor = () => {
    if (!localStorage.getItem('tutorialShown')) {
        showTutorial();
    }
};

// Loads room from URL parameters and connects
const checkUrlForRoom = () => {
    const params = new URLSearchParams(window.location.search);
    const roomId = params.get('room');
    const token = params.get('token');

    if (roomId) {
        window.joinRoom(roomId);
    }
};

// Setup fullscreen toggle events
const setupFullscreenEvents = () => {
    // Add click event listener to remote video container
    const videoContainer = document.querySelector('.video-container');
    const remoteVideoElement = document.getElementById('remote-video');

    // Track click start time to differentiate between clicks and drags
    let clickStartTime = 0;
    const clickThreshold = 200; // ms

    // Track if we're in fullscreen mode
    state.isFullscreen = false;

    // Handle click on video container (for toggle fullscreen)
    videoContainer.addEventListener('mousedown', (e) => {
        // Only trigger on direct clicks on the container or remote video
        // (not on controls or local video)
        if (e.target === videoContainer || e.target === remoteVideoElement) {
            clickStartTime = Date.now();
        }
    });

    videoContainer.addEventListener('mouseup', (e) => {
        // Only toggle fullscreen if:
        // 1. Click started on video container or remote video
        // 2. Click ended on video container or remote video
        // 3. Click was short (not a drag operation)
        if ((e.target === videoContainer || e.target === remoteVideoElement) &&
            clickStartTime > 0 &&
            (Date.now() - clickStartTime < clickThreshold)) {
            toggleFullscreen(videoContainer);
        }
        clickStartTime = 0;
    });

    // For mobile: touchstart/touchend to toggle fullscreen
    videoContainer.addEventListener('touchstart', (e) => {
        // Only track touch on video container or remote video
        if (e.target === videoContainer || e.target === remoteVideoElement) {
            clickStartTime = Date.now();
        }
    });

    videoContainer.addEventListener('touchend', (e) => {
        // Calculate touch duration
        const touchDuration = Date.now() - clickStartTime;

        // Get the touch target
        const touch = e.changedTouches[0];
        const touchTarget = document.elementFromPoint(touch.clientX, touch.clientY);

        // Only toggle fullscreen for short taps directly on video (not controls)
        if ((touchTarget === videoContainer || touchTarget === remoteVideoElement) &&
            clickStartTime > 0 && touchDuration < clickThreshold) {
            toggleFullscreen(videoContainer);
            // Prevent any other handlers from firing (like click events)
            e.preventDefault();
        }
        clickStartTime = 0;
    });

    // Add keyboard support for toggling fullscreen and using controls
    document.addEventListener('keydown', (e) => {
        // If we're in fullscreen mode, handle keyboard shortcuts
        if (state.isFullscreen) {
            // ESC key handled by browser for exiting fullscreen

            // F key for toggling fullscreen
            if (e.key === 'f' || e.key === 'F') {
                toggleFullscreen(videoContainer);
            }

            // M key for muting/unmuting audio
            if (e.key === 'm' || e.key === 'M') {
                toggleAudio();
            }

            // V key for toggling video
            if (e.key === 'v' || e.key === 'V') {
                toggleVideo();
            }

            // Space bar for toggling video play/pause (if implemented)
            if (e.key === ' ' && e.target === document.body) {
                // Prevent page scrolling with spacebar
                e.preventDefault();
            }
        }
    });

    // Add fullscreen change event listeners
    const fullscreenEvents = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'];
    // Use for...of loop
    for (const eventName of fullscreenEvents) {
        document.addEventListener(eventName, updateFullscreenUI);
    }
};

// Update UI when fullscreen state changes
const updateFullscreenUI = () => {
    const isFullscreen =
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement;

    // Update state
    state.isFullscreen = !!isFullscreen;

    // Add or remove fullscreen class for styling
    const videoContainer = document.querySelector('.video-container');
    if (videoContainer) {
        videoContainer.classList.toggle('fullscreen', state.isFullscreen);
    }

    // Update local video container position in fullscreen
    const localVideoContainer = document.getElementById('local-video-container');
    if (localVideoContainer) {
        if (state.isFullscreen) {
            // In fullscreen, ensure local video is properly positioned
            localVideoContainer.classList.add('in-fullscreen');
        } else {
            localVideoContainer.classList.remove('in-fullscreen');
        }
    }

    // Ensure controls are visible and properly positioned in fullscreen
    const controls = document.querySelector('.controls');
    if (controls) {
        if (state.isFullscreen) {
            // Update controls for fullscreen
            controls.classList.add('in-fullscreen');

            // Ensure controls are keyboard accessible in fullscreen
            const controlButtons = controls.querySelectorAll('button');
            // Use for...of loop
            for (const button of controlButtons) {
                button.setAttribute('tabindex', '0');
            }
        } else {
            // Reset controls when exiting fullscreen
            controls.classList.remove('in-fullscreen');
        }
    }

    console.log('Fullscreen state changed:', state.isFullscreen ? 'Entered fullscreen' : 'Exited fullscreen');
};

// Event listeners
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize DOM elements
    initElements();
    
    // 🆕 Set up auth UI FIRST (before initializing auth system)
    setupAuthUI();
    
    // 🆕 Initialize Supabase Auth system
    await initializeAuth();
    
    // ✨ Sprint 4.0: Initialize Call Configuration UI
    // initializeCallConfigUI(); // COMMENTED OUT - causing race condition
    
    // Set up all other event listeners
    setupEventListeners();
    
    // Check URL for room parameters
    checkUrlForRoom();
});

// Initialize DOM element references
const initElements = () => {
    landingPageContainer = document.getElementById('landing-page-container'); // Assign new container
    roomCreatedScreen = document.getElementById('room-created-screen');
    videoChatScreen = document.getElementById('video-chat-screen');
    createRoomBtn = document.getElementById('create-room-btn');
    roomLinkInput = document.getElementById('room-link');
    copyLinkBtn = document.getElementById('copy-link-btn');
    localVideoPreview = document.getElementById('local-preview');
    localVideo = document.getElementById('local-video');
    remoteVideo = document.getElementById('remote-video');
    localVideoContainer = document.getElementById('local-video-container');
    toggleVideoBtn = document.getElementById('toggle-video-btn');
    toggleAudioBtn = document.getElementById('toggle-audio-btn');
    toggleDevicesBtn = document.getElementById('toggle-devices-btn');
    shareScreenBtn = document.getElementById('share-screen-btn');
    endCallBtn = document.getElementById('end-call-btn');
    deviceSelection = document.getElementById('device-selection');
    videoSource = document.getElementById('video-source');
    audioSource = document.getElementById('audio-source');
    audioOutput = document.getElementById('audio-output');
    messageElement = document.getElementById('message');
    tutorialOverlay = document.getElementById('tutorial-overlay');
    tutorialCloseBtn = document.getElementById('tutorial-close-btn');
    statusMessage = document.getElementById('status-message');
    statusPopup = document.getElementById('status-popup');
    statusPopupMessage = document.getElementById('status-popup-message');
    statusPopupClose = document.getElementById('status-popup-close');
    previewVideoSource = document.getElementById('preview-video-source');

    // 🆕 PHASE 1: Make DOM elements available to connection.js (GOLD) without touching it
    // Export all DOM elements connection.js needs via window object
    if (typeof window !== "undefined") {
        window.statusMessage = statusMessage;
        window.roomLinkInput = roomLinkInput;
        window.roomCreatedScreen = roomCreatedScreen;
        window.videoChatScreen = videoChatScreen;
        window.landingPageContainer = landingPageContainer; // welcomeScreen reference
        window.welcomeScreen = landingPageContainer; // connection.js expects welcomeScreen
        window.localVideo = localVideo;
        window.remoteVideo = remoteVideo;
        window.localVideoPreview = localVideoPreview;
        window.deviceSelection = deviceSelection;
        window.toggleVideoBtn = toggleVideoBtn;
        window.toggleAudioBtn = toggleAudioBtn;
        window.toggleDevicesBtn = toggleDevicesBtn;
        window.shareScreenBtn = shareScreenBtn;
        
        // Export UI functions that connection.js calls
        window.switchToScreen = switchToScreen;
        window.showMessage = showMessage;
        window.showDiagnostic = showDiagnostic;
        window.updateConnectionStatus = updateConnectionStatus;
        window.stopScreenSharing = stopScreenSharing;
    }
};

// Setup all event listeners, organized by functionality
const setupEventListeners = () => {
    // Setup by feature groups
    setupRoomManagementEvents();
    setupMediaControlEvents();
    setupDeviceSelectionEvents();
    setupAuthEvents(); // 🆕 Sprint 2.5: Auth event listeners
    // setupFullscreenEvents(); // <-- COMMENTED OUT TEMPORARILY
    setupUIEvents();
    
    // Clear any saved video position to ensure CSS positioning works
    localStorage.removeItem('localVideoPosition');

    // Set Copy/Share button text based on device capabilities
    const copyLinkBtn = document.getElementById('copy-link-btn');
    if (copyLinkBtn) {
        if (navigator.share && window.matchMedia('(max-width: 768px)').matches) {
            copyLinkBtn.textContent = 'Share Link';
        } else {
            copyLinkBtn.textContent = 'Copy Link';
        }
    }

    // Check if first-time visitor
    checkFirstTimeVisitor();

    // Global window events
    setupWindowEvents();
};

// Room creation and management events
const setupRoomManagementEvents = () => {
    // Check if createRoom is available, if not retry after a short delay
    if (!window.createRoom) {
        console.log('⏳ createRoom not yet available, retrying in 100ms...');
        setTimeout(setupRoomManagementEvents, 100);
        return;
    }
    
    createRoomBtn.addEventListener('click', () => {
        console.log('🔧 DEBUG: Create room button clicked');
        console.log('🔧 DEBUG: userState =', window.userState || 'NOT AVAILABLE');
        window.createRoom();
    });
    copyLinkBtn.addEventListener('click', copyRoomLink);
    endCallBtn.addEventListener('click', endCall);
};

// Media control events (video, audio, screen sharing)
const setupMediaControlEvents = () => {
    toggleVideoBtn.addEventListener('click', toggleVideo);
    toggleAudioBtn.addEventListener('click', toggleAudio);
    toggleDevicesBtn.addEventListener('click', toggleDeviceSelection);
    shareScreenBtn.addEventListener('click', toggleScreenShare);
};

// Device selection events
const setupDeviceSelectionEvents = () => {
    videoSource.addEventListener('change', changeVideoDevice);
    audioSource.addEventListener('change', changeAudioDevice);
    audioOutput.addEventListener('change', changeAudioOutput);
    previewVideoSource.addEventListener('change', changePreviewVideoDevice);
};

// Auth events - ✨ Sprint 3.9: Email/Password Authentication
const setupAuthEvents = () => {
    // Auth UI event listeners are already set up in DOMContentLoaded
    // No need to call setupAuthUI() again here
    
    console.log('✅ Auth events initialized for email/password authentication');
};

// UI and tutorial events
const setupUIEvents = () => {
    tutorialCloseBtn.addEventListener('click', closeTutorial);
    statusPopupClose.addEventListener('click', () => {
        statusPopup.style.display = 'none';
    });
};

// Window-level events
const setupWindowEvents = () => {
    // Handle back button
    window.addEventListener('popstate', () => {
        // If we're in a room, clean up and return to root
        if (state.roomId) {
            // Force URL cleanup before general cleanup
            window.history.replaceState({}, '', '/');
            window.cleanupAndReset();
        }
    });

    // Add Shift+ESC handler
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && event.shiftKey && state.roomId) {
            endCall();
        }
    });

    // Handle page unload/refresh to clean up
    window.addEventListener('beforeunload', (event) => {
        console.log('Page unloading - cleaning up all media resources');

        try {
            // Notify server that user is leaving
            if (state.socket && state.roomId) {
                state.socket.emit('burn-room', { roomId: state.roomId });
                state.socket.emit('disconnect');
            }

            // Stop all media tracks
            if (state.localStream) {
                // Use for...of loop
                for (const track of state.localStream.getTracks()) {
                    try {
                        track.stop();
                    } catch (error) {
                        console.error(`Error stopping local ${track.kind} track:`, error);
                    }
                }
            }

            if (state.screenStream) {
                // Use for...of loop
                for (const track of state.screenStream.getTracks()) {
                    try {
                        track.stop();
                    } catch (error) {
                        console.error(`Error stopping screen ${track.kind} track:`, error);
                    }
                }
            }
        } catch (error) {
            console.error('Error during cleanup:', error);
        }
    });
};

// =============================================
// SECURITY UI DISPLAY
// =============================================

// Security badge functionality removed - replaced by Security-Panel component


