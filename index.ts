import { Hono } from 'hono'
import { createBunWebSocket } from 'hono/bun'
import { MessageQueue, Tool, type Unsubscribe } from './core'
import { deserializeMessage } from './message'
import { match, P } from 'ts-pattern'

const { upgradeWebSocket, websocket } = createBunWebSocket()

const messageQueue = new MessageQueue()

const app = new Hono().get(
  '/ws',
  upgradeWebSocket(() => {
    const unsubcribes: Record<string, Unsubscribe> = {}

    return {
      onMessage: (event) => {
        if (typeof event.data !== 'string') {
          return
        }

        const message = deserializeMessage(event.data)
        if (!message) {
          return
        }

        match(message)
          .with({ type: 'START_TOOL' }, ({ session }) => {
            // @ts-expect-error
            // TODO: Find the tool from the tools list and get it
            const tool: Tool = undefined

            const unsubscribe = messageQueue.subscribeChannel(session, () => {})
            unsubcribes[session] = unsubscribe
            tool.run(session, messageQueue)
          })
          .with({ type: 'RECONNECT_TOOL_SESSION' }, ({ session }) => {
            // unsubscribe previous subscription if present
            unsubcribes[session]?.()
            const unsubscribe = messageQueue.subscribeChannel(session, () => {})
            unsubcribes[session] = unsubscribe
          })
          .with(P.not({ type: 'RELOAD' }), (message) => {
            messageQueue.publishMessage(message.session, message)
          })
          .otherwise(() => {})
      },
      onClose: () => {
        for (const unsubcribe of Object.values(unsubcribes)) {
          unsubcribe()
        }
      },
    }
  }),
)

export default {
  fetch: app.fetch,
  websocket,
}
