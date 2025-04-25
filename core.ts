import { z, ZodError } from 'zod'
import type { Message } from './message'

export type Unsubscribe = () => void
export type MessageHandler = (message: Message) => void | Promise<void>

export class MessageQueue {
  /**
   * messagesMap stores all the pending messages that couldn't be
   * pushed to the handler (when there was no handler present)
   */
  private messagesMap = new Map<string, Message[]>()
  /**
   * stores the list of all the subscribers
   */
  private subcribersMap = new Map<string, Set<MessageHandler>>()

  publishMessage(channel: string, message: Message) {
    const handlers = this.subcribersMap.get(channel)
    // if there was no handler, then push the message to the messages map
    // so that it can be sent to the subscriber once they get connected
    if (!handlers || handlers.size === 0) {
      this.messagesMap.set(channel, [
        ...(this.messagesMap.get(channel) ?? []),
        message,
      ])
    } else {
      for (const handler of handlers) {
        handler(message)
      }
    }
  }

  subscribeChannel(channel: string, handler: MessageHandler): Unsubscribe {
    const handlers = this.subcribersMap.get(channel) ?? new Set()
    handlers.add(handler)
    this.subcribersMap.set(channel, handlers)

    while (this.messagesMap.get(channel)?.length) {
      const message = this.messagesMap.get(channel)?.[0]
      invariant(message, 'message should exist')
      handler(message)
      this.messagesMap.set(
        channel,
        this.messagesMap.get(channel)?.slice(1) ?? [],
      )
    }

    return () => {
      this.subcribersMap.get(channel)?.delete(handler)
    }
  }
}

class IO {
  constructor(
    private readonly messageQueue: MessageQueue,
    private readonly session: string,
  ) {}

  // TODO: Add validation checks
  textInput = <T extends boolean>({
    label,
    required,
  }: {
    label: string
    required?: T
  }): Promise<T extends true ? string : string | undefined> => {
    const id = generateId()
    this.messageQueue.publishMessage(this.session, {
      id,
      timestamp: Date.now(),
      session: this.session,
      type: 'RENDER_INPUT_FORM',
      form: {
        value: { type: 'TEXT_INPUT', label, required },
      },
    })
    return new Promise((resolve, reject) => {
      const unsubcribe = this.messageQueue.subscribeChannel(
        this.session,
        (message) => {
          if (
            message.type === 'INPUT_FORM_RESPONSE' &&
            message.parentMessageId === id
          ) {
            const data = message.data.value?.value as T extends true
              ? string
              : string | undefined
            unsubcribe()
            resolve(data)
          } else if (
            message.type === 'INPUT_FORM_CANCELLATION' &&
            message.parentMessageId
          ) {
            unsubcribe()
            reject(
              new IOCancellationError(
                `Cancelled IO for ${message.parentMessageId}`,
              ),
            )
          }
        },
      )
    })
  }
}

type ToolConfig = {
  name: string
  description?: string
  handler: Handler
}
type Handler = (args: { io: IO }) => Promise<unknown>

export class Tool {
  private readonly handler: Handler
  private readonly toolName: string
  private readonly slug: string
  private readonly toolDescription?: string

  constructor(config: ToolConfig) {
    this.handler = config.handler
    this.toolName = config.name
    this.slug = slugify(this.toolName)
    this.toolDescription = config.description
  }

  get name() {
    return this.toolName
  }

  get description() {
    return this.toolDescription
  }

  run(session: string, messageQueue: MessageQueue) {
    const io = new IO(messageQueue, session)
    this.handler({ io })
      .then((output) => {
        messageQueue.publishMessage(session, {
          id: generateId(),
          timestamp: Date.now(),
          type: 'TOOL_COMPLETION',
          session,
          output,
        })
      })
      .catch((error) => {
        messageQueue.publishMessage(session, {
          id: generateId(),
          timestamp: Date.now(),
          type: 'TOOL_ERROR',
          session,
          errorMessage: getErrorMessage(error),
        })
      })
  }
}

function getErrorMessage(
  error: unknown,
  defaultErrorMessage = 'Something went wrong. Please try again.',
) {
  let errorMessage = defaultErrorMessage
  if (error instanceof Error) {
    errorMessage = error.message
  }
  if (error instanceof ZodError) {
    errorMessage = error.message
  }
  return errorMessage
}

function generateId(): string {
  throw new NotImplementedError()
}

function slugify(str: string): string {
  throw new NotImplementedError()
}

function invariant(cond: unknown, message: string): asserts cond {
  if (!cond) {
    throw new InvariantError(message)
  }
}
class NotImplementedError extends Error {
  name = 'NotImplementedError'
}

class InvariantError extends Error {
  name = 'InvariantError'
}

class IOCancellationError extends Error {
  name = 'IOCancellationError'
}
