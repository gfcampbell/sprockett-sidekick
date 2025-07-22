# Oblivn

Oblivn is an anonymous peer-to-peer video chat application using WebRTC. It allows two participants to have a secure, private video conversation without any data storage.

## Features

- Anonymous P2P video chat with no data persistence
- Simple, one-click room creation
- Secure, shareable room links
- Camera and microphone controls
- Device selection (camera, microphone, speaker)
- Screen sharing
- Mobile and desktop compatible
- Light and dark mode support
- Draggable local video

## Technical Overview

Oblivn is built with a minimalist approach, focusing on core functionality and reliability:

- **Client**: Single page application with vanilla JavaScript, HTML, and CSS
- **Server**: Minimal Node.js with Express and Socket.io for signaling only
- **Connection**: WebRTC with STUN/TURN services via metered.ca
- **Security**: End-to-end encrypted media streams, secure room IDs

## Project Structure

```
/oblivn
  /client
    index.html
    styles.css
    config.js
    connection.js
    ui.js
    theme.js
    script.js
  /server
    server.js (signaling server)
    package.json
  README.md
```

## Deployment

### Requirements

- Node.js (v14.0.0 or higher)
- HTTPS support (required for WebRTC in production)

### Deployment Steps for Render.com

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Configure the service:
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Root Directory**: (leave empty to use project root)
4. Click "Create Web Service"

## Local Development

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Start the server:
   ```
   npm start
   ```
4. Open `http://localhost:3000` in your browser

## License

MIT
