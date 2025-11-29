# User Story 06: WebSocket Authentication

## Story

**As a** user importing videos
**I want to** see real-time progress updates
**So that** I know the import status

## UX Flow

```
1. User is logged in
   ↓
2. User starts video import
   ↓
3. Frontend requests Clerk token
   ↓
4. Frontend connects to WebSocket with token
   ↓
5. Backend verifies token on WS connection
   ↓
6. Backend sends progress updates
   ↓
7. Frontend shows real-time progress bar
   ↓
8. Import completes, WebSocket can close
```

## Acceptance Criteria

- [ ] WebSocket requires valid token to connect
- [ ] Invalid token = connection rejected (code 1008)
- [ ] Progress updates sent only to correct user
- [ ] Connection survives token refresh
- [ ] Graceful reconnection on disconnect
- [ ] No cross-user progress leakage

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Token expires during long import | Auto-reconnect with refreshed token |
| User logs out during import | WS closes, import continues server-side |
| Multiple tabs with imports | Each tab gets its own WS, all receive updates |
| Network disconnect | Auto-reconnect when network returns |
| Invalid token on connect | Reject with code 1008, show error |

## Technical Implementation

### Frontend WebSocket Connection

```tsx
// WebSocketProvider.tsx
import { useAuth } from '@clerk/clerk-react'

function WebSocketProvider({ children }) {
  const { getToken } = useAuth()
  const [socket, setSocket] = useState<WebSocket | null>(null)

  useEffect(() => {
    const connect = async () => {
      const token = await getToken()
      if (!token) return

      const ws = new WebSocket(
        `${wsBaseUrl}/api/ws/progress?token=${encodeURIComponent(token)}`
      )

      ws.onclose = (event) => {
        if (event.code === 1008) {
          // Auth error - token invalid
          console.error('WebSocket auth failed')
        } else {
          // Normal close or network issue - try reconnect
          setTimeout(connect, 3000)
        }
      }

      setSocket(ws)
    }

    connect()

    return () => socket?.close()
  }, [getToken])

  return (
    <WebSocketContext.Provider value={socket}>
      {children}
    </WebSocketContext.Provider>
  )
}
```

### Backend WebSocket Handler

```python
# backend/app/api/websocket.py
@router.websocket("/ws/progress")
async def websocket_progress(
    websocket: WebSocket,
    token: str = Query(...)
):
    # Verify Clerk token
    try:
        claims = await verify_clerk_jwt(token)
        user = await get_or_create_user(claims, db)
    except Exception:
        await websocket.close(code=1008)  # Policy Violation
        return

    await websocket.accept()

    try:
        # Subscribe to user's progress channel
        async for message in progress_channel(user.id):
            await websocket.send_json(message)
    except WebSocketDisconnect:
        pass
```

### Token Refresh Strategy

```tsx
// Reconnect with fresh token when needed
const reconnect = async () => {
  // Force fresh token
  const token = await getToken({ skipCache: true })
  // ... connect with new token
}
```

## Security Notes

- Token passed as query param (visible in logs) - acceptable for WS
- Alternative: Pass token in first message after connect
- Backend validates token before accepting connection
- User can only receive their own progress updates
