// connection.js
// WebRTC connection management for Oblivn
// Contains peer connection creation, signaling logic, and connection recovery

import { startSession, endSession } from './sessionLogger.js';
import { userState } from './config.js';
import OblivnAgent from './agent.js';
import { initializeAIAssist, showAIAssist, hideAIAssist, cleanupAIAssist, startAudioTranscription, setVisitorStream } from "./aiAssist.js";
import { initializeCallConfigUI } from './callConfigUI.js';
import { buildSystemPrompt } from './callConfig.js';

// Note: This file relies on functions defined in ui.js:
// - showMessage()
// - showDiagnostic()
// - stopScreenSharing()
// - switchToScreen()
// - updateConnectionStatus()

// =============================================
// STATE MANAGEMENT
// =============================================

/**
 * Global state for WebRTC and connection management
 * Centralized state helps with cleanup and reconnection
 */
const state = {
	socket: null,
	peerConnection: null,
	dataChannel: null,
	agent: null,
	localStream: null,
	screenStream: null,
	remoteStream: null,
	isScreenSharing: false,
	roomId: null,
	roomToken: null, // Security token for room authentication
	tokenExpiration: null, // Token expiration timestamp
	tokenRenewalTimer: null, // Timer for automatic token renewal
	reconnectionAttempts: 0,
	callTimeout: null,
	qualityInterval: null, // Interval for call quality updates (will be reused for calculateAndSetQuality)
	currentVideoDevice: null,
	currentAudioDevice: null,
	currentAudioOutput: null,
	currentSessionId: null, // 🆕 Session tracking for Supabase logging
	
	// ✨ Sprint 4.0: Pre-Call Configuration
	callConfig: {
		useCase: '',     // Selected use case scenario
		goal: '',        // What user wants to accomplish
		context: ''      // Relevant background/details
	},
	
	// ✨ Sprint 4.1: Real-Time Transcript Buffer for AI Coaching
	transcriptBuffer: [] // Rolling transcript: { speaker: 'Host'|'Visitor', text: string, timestamp: number }
};

// =============================================
// SECURITY PANEL GETTERS
// =============================================

const getTlsSignalingStatus = () => window.location.protocol === "https:";

const getDtlsSrtpStatus = () => !!state.peerConnection; // Minimal check: assumes DTLS active if peer connection exists

const getIceConnectionStatus = () => {
	return (
		state.peerConnection?.iceConnectionState === "connected" ||
		state.peerConnection?.iceConnectionState === "completed"
	);
};

const getStunTurnServerStatus = async () => {
	if (!state.peerConnection) {
		return "insecure"; // No connection object
	}

	const iceState = state.peerConnection.iceConnectionState;

	if (iceState === "connected" || iceState === "completed") {
		try {
			const stats = await state.peerConnection.getStats();
			let isRelay = false;

			for (const report of stats.values()) {
				// Find the active candidate pair
				if (report.type === "candidate-pair" && report.state === "succeeded") {
					// Check the type of the local candidate in the active pair
					const localCandidate = stats.get(report.localCandidateId);
					if (localCandidate && localCandidate.candidateType === "relay") {
						isRelay = true;
						break; // Found relay, no need to check further
					}
					// If not relay, assume secure (srflx, prflx, host) for a succeeded pair
					// Break here as we only care about the *one* succeeded pair
					break;
				}
			}

			// Return 'mixed' if TURN/relay is used, otherwise 'secure' for connected state
			return isRelay ? "mixed" : "secure";
		} catch (error) {
			console.warn("Error getting WebRTC stats for STUN/TURN status:", error);
			// If stats fail but connection is 'connected'/'completed', status is uncertain.
			// Defaulting to 'insecure' as we couldn't verify the connection type.
			return "insecure";
		}
	} else {
		// For states 'new', 'checking', 'disconnected', 'failed', 'closed'
		return "insecure";
	}
};

const securityMetricProviders = {
	getTlsSignalingStatus,
	getDtlsSrtpStatus,
	getIceConnectionStatus,
	getStunTurnServerStatus,
};

// =============================================
// SECURITY AND QUALITY METRICS
// =============================================

// The securityMetrics object and its methods were removed in a previous step.
// The calculateAndSetQuality function will be redefined later.

// Calculates quality score and updates the security panel
const calculateAndSetQuality = async () => {
	if (!state.peerConnection) return; // Need peer connection for stats

	try {
		const stats = await state.peerConnection.getStats();
		let quality = 100; // Start with perfect quality

		// Simple quality calculation
		for (const report of stats.values()) {
			// Audio metrics are most reliable for quality
			if (report.type === "inbound-rtp" && report.kind === "audio") {
				// Simple packet loss calculation
				if (report.packetsLost > 0 && report.packetsReceived > 0) {
					const loss =
						report.packetsLost / (report.packetsLost + report.packetsReceived);
					quality -= Math.min(50, loss * 200); // Max 50 point reduction
				}

				// Jitter affects voice quality
				if (report.jitter) {
					quality -= Math.min(30, report.jitter * 500); // Max 30 point reduction
				}
			}
		}

		// Bound to 0-100
		quality = Math.max(0, Math.min(100, Math.round(quality)));
	} catch (e) {
		console.warn("Error calculating or setting quality metrics", e);
	}
};

// =============================================
// TOKEN MANAGEMENT
// =============================================

/**
 * Handles token renewal for long-running sessions
 * Automatically renews tokens before they expire
 */
const setupTokenRenewal = () => {
	// Clear any existing renewal timer
	if (state.tokenRenewalTimer) {
		clearTimeout(state.tokenRenewalTimer);
	}

	// If we don't have a token or expiration, there's nothing to renew
	if (!state.roomToken || !state.tokenExpiration) {
		return;
	}

	// Calculate time until token needs renewal (15 minutes before expiration)
	const now = Date.now();
	const expiration = state.tokenExpiration;
	const renewalWindow = 15 * 60 * 1000; // 15 minutes

	// If token is already expired, renew immediately
	if (expiration <= now) {
		renewToken();
		return;
	}

	// Schedule renewal 15 minutes before expiration
	const timeUntilRenewal = Math.max(0, expiration - now - renewalWindow);
	state.tokenRenewalTimer = setTimeout(renewToken, timeUntilRenewal);

	console.log(
		`Token renewal scheduled in ${Math.round(timeUntilRenewal / 60000)} minutes`,
	);
};

/**
 * Renews the security token by calling the server API
 * @returns {Promise<boolean>} Success status
 */
const renewToken = async () => {
	try {
		if (!state.roomId || !state.roomToken) {
			console.error("Cannot renew token: missing roomId or token");
			return false;
		}

		const response = await fetch("/api/renew-token", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				roomId: state.roomId,
				token: state.roomToken,
			}),
		});

		if (!response.ok) {
			throw new Error(
				`Server returned ${response.status}: ${response.statusText}`,
			);
		}

		const data = await response.json();

		// Update token in state
		state.roomToken = data.token;
		state.tokenExpiration = data.expiration;

		// Update URL with new token without triggering navigation
		const url = new URL(window.location);
		url.searchParams.set("token", data.token);
		window.history.replaceState({}, "", url);

		// Setup next renewal
		setupTokenRenewal();

		console.log("Security token renewed successfully");
		return true;
	} catch (error) {
		console.error("Failed to renew security token:", error);
		showMessage(
			"Security verification error: please reopen this room",
			"warning",
		);
		return false;
	}
};

// =============================================
// SOCKET.IO CONNECTION
// =============================================

/**
 * Initializes Socket.io connection to the signaling server
 * with comprehensive error handling and event listeners
 */
const initializeSocket = () => {
	try {
		showMessage("Connecting to signaling server...", "warning");

		// Connect to socket with explicit path and timeout
		state.socket = io("/", {
			reconnectionAttempts: 5,
			timeout: 20000,
			transports: ["websocket", "polling"],
		});

		// =============================================
		// SOCKET CONNECTION EVENTS
		// =============================================

		state.socket.on("connect", () => {
			showMessage("Connected to signaling server", "success");
			console.log("Socket connected with ID:", state.socket.id);
			console.log("Socket connected");
			updateConnectionStatus(true);

			// Define the metric providers for the Security Panel
			const metricProviders = {
				getTlsSignalingStatus,
				getDtlsSrtpStatus,
				getIceConnectionStatus,
				getStunTurnServerStatus,
				// Add any other relevant getters defined in this file
			};

			// Only initialize if not already done - but do it through dynamic loading
			// ... existing code ...
		});

		state.socket.on("connect_error", (error) => {
			console.error("Socket connection error:", error);
			showMessage(`Server connection error: ${error.message}`, "error");
			statusMessage.textContent = `Connection error: ${error.message}`;
		});

		state.socket.on("connect_timeout", () => {
			console.error("Socket connection timeout");
			showMessage("Server connection timeout", "error");
			statusMessage.textContent = "Connection timeout. Please try again.";
		});

		state.socket.on("error", (error) => {
			console.error("Socket error:", error);
			showMessage(`Server error: ${error.message}`, "error");
		});

		// =============================================
		// ROOM MANAGEMENT EVENTS
		// =============================================

		// Event: Room created successfully
		state.socket.on("room-created", async ({ roomId, token, expiration }) => {
			state.roomId = roomId;
			state.roomToken = token;
			state.tokenExpiration = expiration;

			// ✨ Set host status for AI Assist
			userState.isHost = true;

			// Set up token renewal
			setupTokenRenewal();

			// Create room URL with token
			const roomUrl = `${window.location.origin}?room=${roomId}&token=${token}`;
			roomLinkInput.value = roomUrl;

			switchToScreen(roomCreatedScreen);
			showMessage("Secure room created successfully!", "success");

			// Add room ID and token to URL without reloading
			window.history.pushState(
				{ roomId, token },
				"",
				`?room=${roomId}&token=${token}`,
			);

			// Initialize security panel for the host
			if (window.SecurityPanel) {
				window.SecurityPanel.init({
					getTlsSignalingStatus,
					getDtlsSrtpStatus,
					getIceConnectionStatus,
					getStunTurnServerStatus,
				});
				window.SecurityPanel.startRealtimeMonitoring();
				window.SecurityPanel.setSecurityData({ tokenAuthentication: !!token });
			}

			// ✨ Initialize and show AI Assist for host (on room-created screen)
			initializeAIAssist();
			showAIAssist();
		});

		// Event: Successfully joined a room
		state.socket.on("room-joined", ({ roomId }) => {
			state.roomId = roomId;
			
			// ✨ Visitor (not host) - no AI Assist
			userState.isHost = false;
			
			switchToScreen(videoChatScreen);
			showMessage("Connected to secure room!", "success");

			// Start security metrics monitoring once connected
			if (window.SecurityPanel) {
				// Check if panel exists
				window.SecurityPanel.init({
					getTlsSignalingStatus,
					getDtlsSrtpStatus,
					getIceConnectionStatus,
					getStunTurnServerStatus,
				});
				window.SecurityPanel.startRealtimeMonitoring();
			}

			// Immediately update panel with token status (using state.roomToken which was set in joinRoom)
			if (window.SecurityPanel) {
				window.SecurityPanel.setSecurityData({
					tokenAuthentication: !!state.roomToken,
				});
			}

			// ✨ Initialize AI Assist (will hide if not host)
			initializeAIAssist();
		});

		// Event: Successfully rejoined a room after disconnection
		state.socket.on("room-rejoined", ({ roomId }) => {
			state.roomId = roomId;
			switchToScreen(videoChatScreen);
			showMessage("Reconnected to secure room!", "success");

			// Reinitialize security metrics monitoring
			if (window.SecurityPanel) {
				// Check if panel exists
				window.SecurityPanel.startRealtimeMonitoring(); // CORRECTED FUNCTION CALL
			}
		});

		// =============================================
		// WEBRTC SIGNALING EVENTS
		// =============================================

		// Event: New peer joined the room - initiate WebRTC connection
		state.socket.on("peer-joined", async ({ peerId }) => {
			showMessage("Someone joined the call", "success");
			switchToScreen(videoChatScreen);
			
			// ✨ Show AI Assist for host when call starts
			showAIAssist();
			
			await createPeerConnection();

			// Create and send offer as we're the initiator
			try {
				const offer = await state.peerConnection.createOffer();
				await state.peerConnection.setLocalDescription(offer);
				state.socket.emit("offer", { roomId: state.roomId, offer });
			} catch (error) {
				console.error("Error creating offer:", error);
				showMessage(`Failed to start call: ${error.message}`, "error");
			}
		});

		// Event: Peer rejoined after disconnection
		state.socket.on("peer-rejoined", async ({ peerId }) => {
			showMessage("Your peer has reconnected", "success");

			// If we don't have a peer connection, create one
			if (!state.peerConnection) {
				await createPeerConnection();

				// Create and send offer
				try {
					const offer = await state.peerConnection.createOffer();
					await state.peerConnection.setLocalDescription(offer);
					state.socket.emit("offer", { roomId: state.roomId, offer });
				} catch (error) {
					console.error("Error creating reconnection offer:", error);
					showMessage(`Failed to reconnect: ${error.message}`, "error");
				}
			}
		});

		// Event: Received SDP offer from remote peer
		state.socket.on("offer", async ({ peerId, offer }) => {
			if (!state.peerConnection) {
				await createPeerConnection();
			}

			// ✨ Show AI Assist for host when call starts (for visitors who receive offers)
			showAIAssist();

			try {
				// Set remote description (the offer)
				await state.peerConnection.setRemoteDescription(
					new RTCSessionDescription(offer),
				);

				// Create answer
				const answer = await state.peerConnection.createAnswer();
				await state.peerConnection.setLocalDescription(answer);

				// Send answer back to initiator
				state.socket.emit("answer", { roomId: state.roomId, answer });
			} catch (error) {
				console.error("Error handling offer:", error);
				showMessage(`Failed to connect: ${error.message}`, "error");
			}
		});

		// Event: Received SDP answer from remote peer
		state.socket.on("answer", async ({ peerId, answer }) => {
			try {
				// Complete connection by setting remote description (the answer)
				await state.peerConnection.setRemoteDescription(
					new RTCSessionDescription(answer),
				);
			} catch (error) {
				console.error("Error handling answer:", error);
				showMessage(
					`Failed to establish connection: ${error.message}`,
					"error",
				);
			}
		});

		// Event: Received ICE candidate from remote peer
		state.socket.on("ice-candidate", async ({ peerId, candidate }) => {
			try {
				if (candidate && state.peerConnection) {
					// Add the ICE candidate to enable NAT traversal
					await state.peerConnection.addIceCandidate(
						new RTCIceCandidate(candidate),
					);
				}
			} catch (error) {
				console.error("Error adding ICE candidate:", error);
			}
		});

		// =============================================
		// DISCONNECTION EVENTS
		// =============================================

		// Event: Remote peer disconnected
		state.socket.on("peer-disconnected", ({ peerId }) => {
			showMessage("The other person left the call", "warning");
			cleanupPeerConnection();
			updateConnectionStatus(false);

			// If we were the one who created the room, go back to waiting
			if (window.location.search.includes("room")) {
				switchToScreen(roomCreatedScreen);
			} else {
				cleanupAndReset();
			}
		});

		// Event: Call manually ended by any participant
		state.socket.on("room-burned", () => {
			showMessage("Call ended by participant", "warning");
			cleanupAndReset();
		});

		// Event: Error message from server
		state.socket.on("error", ({ message }) => {
			showMessage(message, "error");
		});
	} catch (error) {
		console.error("Error initializing socket:", error);
		showMessage(`Server connection failed: ${error.message}`, "error");
		statusMessage.textContent =
			"Failed to connect to server. Please reload the page.";
	}
};

// =============================================
// ROOM MANAGEMENT
// =============================================

/**
 * Joins an existing room using room ID and security token
 * @param {string} roomId - Room identifier
 * @returns {Promise<boolean>} Success status
 */
const joinRoom = async (roomId) => {
	// Clear previous status
	statusMessage.textContent = "";

	if (!window.RTCPeerConnection) {
		showMessage(
			"Your browser does not support video calls. Please try Chrome, Firefox, or Safari.",
			"error",
		);
		showDiagnostic(
			"WebRTC is not supported in your browser. Please update your browser or try a different one like Chrome, Firefox, or Safari.",
		);
		return false;
	}

	try {
		// First attempt to get camera/mic access
		const mediaSuccess = await setupLocalMedia();
		if (!mediaSuccess) {
			return false;
		}

		// Get token from URL if available
		const urlParams = new URLSearchParams(window.location.search);
		const token = urlParams.get("token");

		if (token) {
			state.roomToken = token;
			// We don't know expiration yet, but we'll set it when we join the room
		}

		// Initialize socket and join the room
		initializeSocket();

		// Join room with token if available
		state.socket.emit("join-room", {
			roomId,
			token: state.roomToken,
		});

		showMessage("Joining secure room...", "warning");
		return true;
	} catch (error) {
		console.error("Error joining room:", error);
		showMessage(`Could not join room: ${error.message}`, "error");
		return false;
	}
};

/**
 * Creates a new room on the server
 * @returns {Promise<boolean>} Success status
 */
const createRoom = async () => {
	// Clear previous status
	statusMessage.textContent = "";

	if (!window.RTCPeerConnection) {
		showMessage(
			"Your browser does not support video calls. Please try Chrome, Firefox, or Safari.",
			"error",
		);
		showDiagnostic(
			"WebRTC is not supported in your browser. Please update your browser or try a different one like Chrome, Firefox, or Safari.",
		);
		return false;
	}

	try {
		// First attempt to get camera/mic access
		const mediaSuccess = await setupLocalMedia();
		if (!mediaSuccess) {
			return false;
		}

		// Initialize socket and create room
		initializeSocket();
		state.socket.emit("create-room");
		showMessage("Creating secure room...", "warning");
		return true;
	} catch (error) {
		console.error("Error creating room:", error);
		showMessage(`Could not create room: ${error.message}`, "error");
		return false;
	}
};

/**
 * Cleans up resources and resets state when call ends
 * Properly stops all streams and closes connections
 */
const cleanupAndReset = () => {
	try {
		// ✨ Cleanup AI Assist
		cleanupAIAssist();
		hideAIAssist();
		userState.isHost = false;

		// 🆕 END SESSION LOGGING
		if (state.currentSessionId) {
			endSession(state.currentSessionId, state.peerConnection)
				.then(success => {
					if (success) {
						console.log(`📊 Session ended during cleanup: ${state.currentSessionId}`);
					}
				})
				.catch(error => {
					console.error('❌ Failed to end session during cleanup:', error);
				})
				.finally(() => {
					state.currentSessionId = null;
				});
		}

		// Stop token renewal
		if (state.tokenRenewalTimer) {
			clearTimeout(state.tokenRenewalTimer);
			state.tokenRenewalTimer = null;
		}

		// Clear room ID
		state.roomId = null;

		// Clear URL parameter without reloading
		window.history.replaceState({}, "", "/");

		// Reset UI
		switchToScreen(welcomeScreen);
		updateConnectionStatus(false);

		// Stop screen sharing if active
		if (state.isScreenSharing) {
			try {
				stopScreenSharing();
			} catch (error) {
				console.error("Error stopping screen sharing during cleanup:", error);
			}
		}

		// Clean up peer connection (handles remote streams)
		cleanupPeerConnection();

		// Stop local media
		if (state.localStream) {
			try {
				const localTracks = state.localStream.getTracks();
				console.log(`Cleaning up ${localTracks.length} local tracks`);
				for (const track of localTracks) {
					try {
						track.stop();
						console.log(`Stopped local ${track.kind} track: ${track.id}`);
					} catch (trackError) {
						console.error(
							`Error stopping local ${track.kind} track:`,
							trackError,
						);
					}
				}
				state.localStream = null;
				if (localVideo?.srcObject) {
					localVideo.srcObject = null;
				}
				if (localVideoPreview?.srcObject) {
					localVideoPreview.srcObject = null;
				}
			} catch (mediaError) {
				console.error("Error cleaning up local media:", mediaError);
			}
		}

		// Double-check screen stream cleanup
		if (state.screenStream) {
			try {
				const screenTracks = state.screenStream.getTracks();
				console.log(`Cleaning up ${screenTracks.length} screen sharing tracks`);
				for (const track of screenTracks) {
					try {
						track.stop();
						console.log(`Stopped screen ${track.kind} track: ${track.id}`);
					} catch (trackError) {
						console.error(
							`Error stopping screen ${track.kind} track:`,
							trackError,
						);
					}
				}
				state.screenStream = null;
			} catch (screenError) {
				console.error("Error cleaning up screen sharing media:", screenError);
			}
		}

		// Clean up any preview streams that might be separate
		if (
			localVideoPreview?.srcObject &&
			localVideoPreview.srcObject !== state.localStream
		) {
			try {
				const previewTracks = localVideoPreview.srcObject.getTracks();
				console.log(`Cleaning up ${previewTracks.length} preview tracks`);
				for (const track of previewTracks) {
					track.stop();
				}
				localVideoPreview.srcObject = null;
			} catch (previewError) {
				console.error("Error cleaning up preview media:", previewError);
			}
		}

		// Reset device selection panel
		state.deviceSelectionVisible = false;
		deviceSelection.style.display = "none";
		toggleDevicesBtn.classList.remove("active");

		// Reset button states
		toggleVideoBtn.classList.remove("muted");
		toggleAudioBtn.classList.remove("muted");
		shareScreenBtn.classList.remove("active");

		// Reset state flags
		state.isAudioMuted = false;
		state.isVideoMuted = false;
		state.isScreenSharing = false;
		state.isConnected = false;

		console.log("Cleanup and reset completed successfully");
	} catch (error) {
		console.error("Error during cleanup and reset:", error);
		// Try emergency cleanup as a last resort
		try {
			if (state.peerConnection) {
				state.peerConnection.close();
				state.peerConnection = null;
			}
			if (state.localStream) {
				for (const track of state.localStream.getTracks()) {
					track.stop();
				}
				state.localStream = null;
			}
			if (state.screenStream) {
				for (const track of state.screenStream.getTracks()) {
					track.stop();
				}
				state.screenStream = null;
			}
			if (localVideo) localVideo.srcObject = null;
			if (remoteVideo) remoteVideo.srcObject = null;
			if (localVideoPreview) localVideoPreview.srcObject = null;
		} catch (emergencyError) {
			console.error("Emergency cleanup also failed:", emergencyError);
		}
	}
};

// =============================================
// WEBRTC PEER CONNECTION
// =============================================

/**
 * Creates a WebRTC peer connection with ICE servers
 * Sets up all event handlers and media tracks
 * @returns {Promise<void>}
 */
const createPeerConnection = async () => {
	try {
		// Get iceServers from the server for NAT traversal
		let iceServers;
		try {
			const response = await fetch("/api/ice-servers");
			if (!response.ok) {
				throw new Error(
					`Server returned ${response.status}: ${response.statusText}`,
				);
			}
			const data = await response.json();
			iceServers = data.iceServers;
			console.log("Obtained ICE servers:", iceServers.length);
		} catch (error) {
			console.warn("Could not get ICE servers, using STUN only:", error);
			showMessage(
				"Using basic connection mode - calls may be less reliable",
				"warning",
			);
			iceServers = [{ urls: "stun:stun.relay.metered.ca:80" }];
		}

		// Create RTCPeerConnection with ICE servers
		try {
			state.peerConnection = new RTCPeerConnection({ iceServers });
			console.log("RTCPeerConnection created.");
		} catch (iceError) {
			// If ICE servers are malformed (like missing TURN credentials), fallback to STUN only
			console.warn("ICE servers malformed, falling back to STUN-only:", iceError);
			showMessage("Using basic connection mode (STUN-only)", "warning");
			const stunOnlyServers = [
				{ urls: "stun:stun.l.google.com:19302" },
				{ urls: "stun:stun1.l.google.com:19302" }
			];
			state.peerConnection = new RTCPeerConnection({ iceServers: stunOnlyServers });
			console.log("RTCPeerConnection created with STUN-only fallback.");
		}

		// Create data channel for agent communication
		state.dataChannel = state.peerConnection.createDataChannel("agent");
		console.log("Data channel created for agent communication.");

		// Handle incoming data channels from remote peer
		state.peerConnection.ondatachannel = (event) => {
			const channel = event.channel;
			console.log("Received data channel:", channel.label);
			
			if (channel.label === "agent" && !state.dataChannel) {
				// Use the incoming data channel if we don't have one
				state.dataChannel = channel;
				console.log("Using incoming data channel for agent communication.");
			}
		};

		// Add local media tracks to the peer connection
		if (state.localStream) {
			for (const track of state.localStream.getTracks()) {
				state.peerConnection.addTrack(track, state.localStream);
			}
		} else {
			console.warn("No local stream available when creating peer connection");
			showMessage(
				"No camera/microphone access when establishing connection",
				"warning",
			);
		}

		// =============================================
		// ICE CANDIDATE HANDLING
		// =============================================

		// When we have a new ICE candidate, send it to the peer
		state.peerConnection.onicecandidate = (event) => {
			if (event.candidate) {
				state.socket.emit("ice-candidate", {
					roomId: state.roomId,
					candidate: event.candidate,
				});
			}
		};

		// =============================================
		// CONNECTION STATE MONITORING
		// =============================================

		// Monitor connection state changes
		state.peerConnection.onconnectionstatechange = () => {
			console.log("Connection state:", state.peerConnection.connectionState);

			if (state.peerConnection.connectionState === "connected") {
				// Reset reconnection attempts counter when successfully connected
				state.reconnectionAttempts = 0;
				updateConnectionStatus(true);
				showMessage("Connected to peer", "success");

				// 🆕 START SESSION LOGGING
				try {
					// Detect if this is video or voice-only call
					const mode = state.peerConnection.getSenders().some(s => s.track && s.track.kind === 'video') ? 'video' : 'voice-only';
					
					// Determine user ID: use authenticated user or fallback to anonymous
					const userId = userState.currentUserId || `anonymous_${Date.now()}`;
					
					// Start session tracking (use .then() to avoid async in event handler)
					startSession(userId, state.roomId, mode, state.peerConnection)
						.then(sessionId => {
							if (sessionId) {
								state.currentSessionId = sessionId;
								console.log(`📊 Session tracking started: ${sessionId}`);
							}
						})
						.catch(sessionError => {
							console.error('❌ Failed to start session tracking:', sessionError);
							// Continue with call - session tracking failure shouldn't break the call
						});
				} catch (sessionError) {
					console.error('❌ Failed to start session tracking:', sessionError);
					// Continue with call - session tracking failure shouldn't break the call
				}

				// ✨ Sprint 3 Phase 2: Start audio transcription for hosts with AI Assist enabled
				if (userState.isHost && userState.aiAssistEnabled && state.localStream) {
					try {
						startAudioTranscription(state.localStream);
						console.log('🎤 Audio transcription started for AI Assist');
					} catch (transcriptionError) {
						console.error('❌ Failed to start audio transcription:', transcriptionError);
						// Continue with call - transcription failure shouldn't break the call
					}
				}

				// Start the agent for autonomous connection monitoring
				if (state.dataChannel && state.dataChannel.readyState === "open") {
					state.agent = new OblivnAgent(state.peerConnection, state.dataChannel, window.showMessage);
					state.agent.start();
					console.log("🤖 Agent started for connection monitoring");
					
					// Show peer fingerprint for verification
					state.agent.getPeerFingerprint().then(fp => {
						console.log("🔐 Peer Fingerprint:", fp);
						if (fp && typeof window.showTrustOverlay === "function") {
							window.showTrustOverlay(fp);
						}
					});
				} else {
					// Wait for data channel to open
					state.dataChannel.onopen = () => {
						state.agent = new OblivnAgent(state.peerConnection, state.dataChannel, window.showMessage);
						state.agent.start();
						console.log("🤖 Agent started for connection monitoring");
						
						// Show peer fingerprint for verification
						state.agent.getPeerFingerprint().then(fp => {
							console.log("🔐 Peer Fingerprint:", fp);
							if (fp && typeof window.showTrustOverlay === "function") {
								window.showTrustOverlay(fp);
							}
						});
					};
				}

				// Check if remote video is enabled
				setTimeout(() => {
					// Give it a moment to determine if video is active
					if (remoteVideo.srcObject) {
						const videoTracks = remoteVideo.srcObject.getVideoTracks();
						const isVideoActive =
							videoTracks.length > 0 &&
							videoTracks.some((track) => track.enabled);
						updateRemoteVideoState(isVideoActive);
					} else {
						updateRemoteVideoState(false);
					}
				}, 1000);
			} else if (state.peerConnection.connectionState === "disconnected") {
				updateConnectionStatus(false);
				showMessage("Peer disconnected", "warning");

				// Start reconnection process with a slight delay
				if (!state.reconnecting) {
					state.reconnecting = true;
					setTimeout(async () => {
						// Check if still disconnected before attempting reconnection
						if (
							state.peerConnection &&
							(state.peerConnection.connectionState === "disconnected" ||
								state.peerConnection.connectionState === "failed")
						) {
							await attemptReconnection();
						}
						state.reconnecting = false;
					}, 2000);
				}
			} else if (state.peerConnection.connectionState === "failed") {
				updateConnectionStatus(false);
				showMessage("Connection failed", "error");

				// Implement retry logic with maximum attempts
				if (!state.reconnectionAttempts) {
					state.reconnectionAttempts = 0;
				}

				if (state.reconnectionAttempts < 3 && !state.reconnecting) {
					state.reconnectionAttempts++;
					state.reconnecting = true;

					showMessage(
						`Reconnection attempt ${state.reconnectionAttempts}/3...`,
						"warning",
					);

					setTimeout(async () => {
						await attemptReconnection();
						state.reconnecting = false;
					}, 2000 * state.reconnectionAttempts); // Increasing backoff
				} else if (state.reconnectionAttempts >= 3) {
					showDiagnostic(
						"WebRTC connection failed after multiple attempts. This might be due to firewall restrictions or network issues. Try refreshing the page or using a different network.",
					);
				}
			} else if (state.peerConnection.connectionState === "closed") {
				updateConnectionStatus(false);
			}
		};

		// Monitor ICE connection state
		state.peerConnection.oniceconnectionstatechange = () => {
			console.log(
				"ICE connection state:",
				state.peerConnection.iceConnectionState,
			);

			// Trigger security update on ICE state change
			calculateAndSetQuality();

			if (state.peerConnection.iceConnectionState === "failed") {
				showMessage("Network connection problem detected", "error");

				// Only attempt reconnection if not already reconnecting
				if (
					!state.reconnecting &&
					(!state.reconnectionAttempts || state.reconnectionAttempts < 3)
				) {
					if (!state.reconnectionAttempts) {
						state.reconnectionAttempts = 0;
					}

					state.reconnectionAttempts++;
					state.reconnecting = true;

					showMessage(
						`ICE reconnection attempt ${state.reconnectionAttempts}/3...`,
						"warning",
					);

					setTimeout(async () => {
						// Attempt ICE restart by creating a new offer with iceRestart: true
						if (state.peerConnection) {
							try {
								await attemptIceRestart();
							} catch (error) {
								console.error("Error creating ICE restart offer:", error);
								// Fall back to full reconnection if ICE restart fails
								await attemptReconnection();
							}
						} else {
							await attemptReconnection();
						}
						state.reconnecting = false;
					}, 2000 * state.reconnectionAttempts);
				} else if (state.reconnectionAttempts >= 3) {
					showDiagnostic(
						"Failed to establish a direct connection after multiple attempts. This often happens due to firewall restrictions. Try a different network or device.",
					);
				}
			} else if (state.peerConnection.iceConnectionState === "disconnected") {
				showMessage("Network connection interrupted", "warning");

				// For ICE disconnections, wait a moment as they might self-recover
				if (!state.iceReconnectTimer) {
					state.iceReconnectTimer = setTimeout(() => {
						if (
							state.peerConnection &&
							state.peerConnection.iceConnectionState === "disconnected" &&
							!state.reconnecting
						) {
							// Try ICE restart if still disconnected
							state.reconnecting = true;
							attemptIceRestart().finally(() => {
								state.reconnecting = false;
							});
						}
						state.iceReconnectTimer = null;
					}, 5000);
				}
			} else if (state.peerConnection.iceConnectionState === "connected") {
				// Clear any pending reconnection timers
				if (state.iceReconnectTimer) {
					clearTimeout(state.iceReconnectTimer);
					state.iceReconnectTimer = null;
				}
			}
		};

		// =============================================
		// REMOTE TRACK HANDLING
		// =============================================

		// Handle incoming tracks from remote peer
		state.peerConnection.ontrack = (event) => {
			if (remoteVideo.srcObject !== event.streams[0]) {
				remoteVideo.srcObject = event.streams[0];
				console.log("Received remote stream");

				// ✨ Connect visitor stream to AI coaching system
				if (userState.isHost && event.streams[0]) {
					setVisitorStream(event.streams[0]);
					console.log("🎤 Visitor stream connected to AI coaching");
				}

				// Monitor track mute state
				event.track.onmute = () => {
					if (event.track.kind === "video") {
						updateRemoteVideoState(false);
					}
				};

				event.track.onunmute = () => {
					if (event.track.kind === "video") {
						updateRemoteVideoState(true);
					}
				};

				// Also check video tracks enabled state
				const checkVideoState = () => {
					const videoTracks = event.streams[0].getVideoTracks();
					const isVideoActive =
						videoTracks.length > 0 && videoTracks[0].enabled;
					updateRemoteVideoState(isVideoActive);
				};

				// Initial check
				checkVideoState();

				// Set up periodic checking (WebRTC doesn't always fire events reliably)
				setInterval(checkVideoState, 2000);
			}
		};

		console.log("Peer connection created successfully");

		// Initialize security and quality monitoring
		if (window.SecurityPanel) {
			// Initial security update
			calculateAndSetQuality();

			// Monitor ICE connection state changes
			state.peerConnection.addEventListener("iceconnectionstatechange", () => {
				calculateAndSetQuality();
			});
		}

		return state.peerConnection;
	} catch (error) {
		console.error("Error creating peer connection:", error);
		showMessage(`Could not create connection: ${error.message}`, "error");
		showDiagnostic(
			`Connection error: ${error.message}. This might be a browser compatibility issue or a network problem.`,
		);
		return null;
	}
};

/**
 * Attempts to re-establish a broken WebRTC connection
 * Uses existing signaling and connection infrastructure
 * @returns {Promise<boolean>} Success status of reconnection attempt
 */
const attemptReconnection = async () => {
	try {
		console.log("Attempting WebRTC reconnection...");
		showMessage("Attempting to reconnect...", "warning");

		// Clean up existing peer connection without fully resetting
		if (state.peerConnection) {
			// Remove event handlers
			state.peerConnection.ontrack = null;
			state.peerConnection.onicecandidate = null;
			state.peerConnection.oniceconnectionstatechange = null;
			state.peerConnection.onconnectionstatechange = null;

			// Close connection
			state.peerConnection.close();
			state.peerConnection = null;
		}

		// Maintain room ID and other state for reconnection
		if (!state.roomId) {
			console.error("Cannot reconnect - no room ID");
			showMessage("Cannot reconnect to call", "error");
			return false;
		}

		// Try to rejoin the room on the server first
		state.socket.emit("rejoin-room", { roomId: state.roomId });

		// Set up a timeout to handle rejoin failure
		const rejoinTimeout = setTimeout(() => {
			console.log("Rejoin timed out, falling back to normal reconnection");
			startReconnection();
		}, 5000);

		// Listen for room-rejoined event
		const roomRejoinedHandler = ({ roomId }) => {
			clearTimeout(rejoinTimeout);
			console.log("Successfully rejoined room:", roomId);
			startReconnection();
		};

		// Listen for peer-rejoined event
		const peerRejoinedHandler = ({ peerId }) => {
			console.log("Peer rejoined:", peerId);
			// If we're already connected, we don't need to do anything
			if (
				state.peerConnection &&
				state.peerConnection.connectionState === "connected"
			) {
				console.log("Already connected, ignoring peer-rejoined event");
				return;
			}
			startReconnection();
		};

		// Add event listeners
		state.socket.once("room-rejoined", roomRejoinedHandler);
		state.socket.once("peer-rejoined", peerRejoinedHandler);

		// Define the actual reconnection logic
		const startReconnection = async () => {
			// Clean up event listeners to avoid duplicates
			state.socket.off("room-rejoined", roomRejoinedHandler);
			state.socket.off("peer-rejoined", peerRejoinedHandler);

			// Create new peer connection with all the event handlers
			await createPeerConnection();

			// Initiate reconnection based on role (determine if we should create offer)
			const shouldCreateOffer = window.location.search.includes("room");

			if (shouldCreateOffer) {
				// We created the room, so we initiate the connection
				const offer = await state.peerConnection.createOffer();
				await state.peerConnection.setLocalDescription(offer);
				state.socket.emit("offer", { roomId: state.roomId, offer });
				console.log("Sent reconnection offer");
			} else {
				// We'll wait for an offer from the other side
				console.log("Waiting for reconnection offer");
				showMessage("Waiting for peer to reconnect...", "warning");
			}
		};

		return true;
	} catch (error) {
		console.error("Reconnection attempt failed:", error);
		showMessage(`Reconnection failed: ${error.message}`, "error");
		return false;
	}
};

/**
 * Attempts to restart ICE for an existing connection
 * Less disruptive than full reconnection
 * @returns {Promise<boolean>} Success status
 */
const attemptIceRestart = async () => {
	try {
		if (!state.peerConnection) {
			return false;
		}

		console.log("Attempting ICE restart...");
		showMessage("Attempting to restore connection...", "warning");

		// Create offer with ICE restart flag
		const offer = await state.peerConnection.createOffer({
			iceRestart: true,
		});

		await state.peerConnection.setLocalDescription(offer);
		state.socket.emit("offer", { roomId: state.roomId, offer });

		console.log("ICE restart offer sent");
		return true;
	} catch (error) {
		console.error("ICE restart failed:", error);
		return false;
	}
};

// Get user media (camera, microphone) with improved error handling
const setupLocalMedia = async () => {
	let constraints; // Define constraints at function scope so it can be used in both try blocks
	try {
		// First check if getUserMedia is supported
		if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
			throw new Error(
				"Your browser doesn't support camera/microphone access. Please try Chrome, Firefox, or Safari.",
			);
		}

		showMessage("Requesting camera and microphone access...", "warning");

		constraints = {
			audio: true,
			video: {
				width: { ideal: 1280 },
				height: { ideal: 720 },
			},
		};

		// Try to get camera and mic access
		console.log("Requesting media with constraints:", constraints);
		state.localStream = await navigator.mediaDevices.getUserMedia(constraints);
		console.log(
			"Media access granted:",
			state.localStream.getTracks().map((t) => t.kind),
		);

		// Set videos
		localVideo.srcObject = state.localStream;
		localVideoPreview.srcObject = state.localStream;

		// Default camera to on
		const videoTracks = state.localStream.getVideoTracks();
		if (videoTracks.length > 0) {
			videoTracks[0].enabled = true;
			state.isVideoMuted = false;
			toggleVideoBtn.classList.remove("muted");
		}

		showMessage("Camera and microphone access granted", "success");
		return true;
	} catch (error) {
		console.error("Error accessing media devices:", error);

		// Show friendly error based on error type
		if (error.name === "NotAllowedError") {
			showMessage(
				"Camera/microphone access denied. Please allow access and try again.",
				"error",
			);
			showDiagnostic(
				"You denied permission to use your camera/microphone. Please click the camera icon in your browser address bar and allow access, then try again.",
			);
		} else if (error.name === "NotFoundError") {
			showMessage(
				"No camera or microphone found. Please connect a device and try again.",
				"error",
			);
			showDiagnostic(
				"No camera or microphone was detected. Please check your device connections and make sure they're not being used by another application.",
			);
		} else if (error.name === "NotReadableError") {
			showMessage(
				"Your camera or microphone is already in use by another application.",
				"error",
			);
			showDiagnostic(
				"Your camera or microphone is already being used by another application. Please close other video apps and try again.",
			);
		} else if (error.name === "OverconstrainedError") {
			showMessage(
				"Your camera doesn't support the required resolution.",
				"error",
			);
			showDiagnostic(
				"Your camera doesn't support the required resolution. We'll try again with lower settings.",
			);
			// Try again with less strict constraints
			try {
				constraints = { audio: true, video: true };
				state.localStream =
					await navigator.mediaDevices.getUserMedia(constraints);
				localVideo.srcObject = state.localStream;
				localVideoPreview.srcObject = state.localStream;
				return true;
			} catch (fallbackError) {
				console.error("Fallback media error:", fallbackError);
				showMessage("Could not access camera/microphone.", "error");
				return false;
			}
		} else {
			showMessage(`Media error: ${error.message}`, "error");
			statusMessage.textContent = `Camera/mic error: ${error.message}`;
		}
		return false;
	}
};

// Clean up the peer connection
const cleanupPeerConnection = () => {
	try {
		// Stop and cleanup agent first
		if (state.agent) {
			console.log("Stopping agent");
			state.agent.stop();
			state.agent = null;
		}

		// Cleanup data channel
		if (state.dataChannel) {
			console.log("Cleaning up data channel");
			state.dataChannel.onopen = null;
			state.dataChannel.onmessage = null;
			state.dataChannel.close();
			state.dataChannel = null;
		}

		if (state.peerConnection) {
			console.log("Cleaning up peer connection");

			// Remove all event handlers
			state.peerConnection.ontrack = null;
			state.peerConnection.onicecandidate = null;
			state.peerConnection.oniceconnectionstatechange = null;
			state.peerConnection.onconnectionstatechange = null;

			// Stop all senders (outgoing tracks)
			try {
				const senders = state.peerConnection.getSenders();
				if (senders?.length) {
					console.log(`Cleaning up ${senders.length} sender tracks`);
					for (const sender of senders) {
						if (sender.track) {
							sender.track.stop();
						}
					}
				}
			} catch (senderError) {
				console.error("Error stopping sender tracks:", senderError);
			}

			// Close the connection
			state.peerConnection.close();
			state.peerConnection = null;

			// Stop tracks from remote stream
			if (remoteVideo.srcObject) {
				const tracks = remoteVideo.srcObject.getTracks();
				console.log(`Cleaning up ${tracks.length} remote tracks`);
				for (const track of tracks) {
					try {
						track.stop();
					} catch (trackError) {
						console.error("Error stopping remote track:", trackError);
					}
				}
				remoteVideo.srcObject = null;
			}

			console.log("Peer connection cleaned up successfully");
		}
	} catch (error) {
		console.error("Error cleaning up peer connection:", error);
		// Don't show user message for cleanup errors, just log them
	}
};

// Update remote video status (used to display video inactive overlay)
const updateRemoteVideoState = (isVideoActive) => {
	const remoteVideoOff = document.getElementById("remote-video-off");
	if (remoteVideoOff) {
		remoteVideoOff.style.display = isVideoActive ? "none" : "flex";
	}
};

/**
 * Toggles fullscreen mode for the video container with cross-browser support
 * Handles prefixed APIs (webkit, moz, ms) and provides fallbacks
 * @param {HTMLElement} element - The element to toggle fullscreen (defaults to video container)
 * @returns {Boolean} - True if entering fullscreen, false if exiting
 */
const toggleFullscreen = (element) => {
	try {
		// Default to video container if no element specified
		const targetElement = element || document.querySelector(".video-container");

		if (!targetElement) {
			console.error("Fullscreen target element not found");
			return false;
		}

		// Track if we're entering or exiting fullscreen
		let isEnteringFullscreen = false;

		// Check if fullscreen is currently active
		const isFullscreen =
			document.fullscreenElement ||
			document.webkitFullscreenElement ||
			document.mozFullScreenElement ||
			document.msFullscreenElement;

		if (!isFullscreen) {
			// Ensure controls are within video container for fullscreen
			const controlsElement = document.querySelector(".controls");

			// Request fullscreen with cross-browser support
			if (targetElement.requestFullscreen) {
				targetElement.requestFullscreen();
				isEnteringFullscreen = true;
			} else if (targetElement.webkitRequestFullscreen) {
				// Safari, Chrome
				targetElement.webkitRequestFullscreen();
				isEnteringFullscreen = true;
			} else if (targetElement.mozRequestFullScreen) {
				// Firefox
				targetElement.mozRequestFullScreen();
				isEnteringFullscreen = true;
			} else if (targetElement.msRequestFullscreen) {
				// IE/Edge
				targetElement.msRequestFullscreen();
				isEnteringFullscreen = true;
			} else {
				console.warn("Fullscreen API not supported in this browser");
				showMessage("Fullscreen not supported in your browser", "warning");
				return false;
			}

			showMessage("Fullscreen mode enabled", "success");
		} else {
			// Exit fullscreen with cross-browser support
			if (document.exitFullscreen) {
				document.exitFullscreen();
			} else if (document.webkitExitFullscreen) {
				// Safari, Chrome
				document.webkitExitFullscreen();
			} else if (document.mozCancelFullScreen) {
				// Firefox
				document.mozCancelFullScreen();
			} else if (document.msExitFullscreen) {
				// IE/Edge
				document.msExitFullscreen();
			}

			showMessage("Fullscreen mode disabled", "success");
		}

		return isEnteringFullscreen;
	} catch (error) {
		console.error("Error toggling fullscreen:", error);
		showMessage("Error toggling fullscreen", "error");
		return false;
	}
};

// Don't forget to expose the toggleFullscreen function if using module exports
if (typeof module !== "undefined" && module.exports) {
	module.exports = {
		// Export existing functions
		// ... existing exports ...
		toggleFullscreen,
		setupLocalMedia,
		// Export new reconnection functions for testing
		attemptReconnection,
		attemptIceRestart,
		createPeerConnection,
	};
}

// Make setupLocalMedia available to the window object for use in ui.js
if (typeof window !== "undefined") {
	window.setupLocalMedia = setupLocalMedia;
	// 🆕 PHASE 1: Make connection functions available to ui.js
	window.createRoom = createRoom;
	window.joinRoom = joinRoom;
	window.cleanupAndReset = cleanupAndReset;
	// 🆕 PHASE 1: Make state object available to ui.js
	window.state = state;
}
