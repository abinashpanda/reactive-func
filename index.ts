import { Hono } from 'hono'
import { createBunWebSocket } from 'hono/bun'
import { MessageQueue } from './core'

const { upgradeWebSocket, websocket } = createBunWebSocket()

const messageQueue = new MessageQueue()

const app = new Hono().get(
  '/ws',
  upgradeWebSocket(() => {
    return {
      onMessage: (event) => {},
    }
  }),
)

export default {
  fetch: app.fetch,
  websocket,
}
