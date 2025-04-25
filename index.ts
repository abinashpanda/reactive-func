import { z } from 'zod'

type Unsubscribe = () => void
type MessageHandler = (message: Message) => void | Promise<void>

class MessageQueue {
  publishMessage(channel: string, message: Message) {
    throw new NotImplementedError()
  }

  subscribeChannel(channel: string, handler: MessageHandler): Unsubscribe {
    throw new NotImplementedError()
  }
}

class IO {
  constructor(
    private readonly messageQueue: MessageQueue,
    private readonly toolChannel: string,
  ) {}

  textInput = <T extends boolean>({
    label,
    required,
  }: {
    label: string
    required?: T
  }): Promise<T extends true ? string : string | undefined> => {
    const id = generateId()
    this.messageQueue.publishMessage(this.toolChannel, {
      id,
      timestamp: Date.now(),
      type: 'RENDER_INPUT_FORM',
      form: {
        value: { type: 'TEXT_INPUT', label, required },
      },
    })
    return new Promise((resolve, reject) => {
      const unsubcribe = this.messageQueue.subscribeChannel(
        this.toolChannel,
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

class Tool {
  private readonly handler: Handler
  private readonly slug: string
  private readonly name: string
  private readonly description?: string
  constructor(config: ToolConfig) {
    this.handler = config.handler
    this.name = config.name
    this.slug = slugify(this.name)
    this.description = config.description
  }

  run(session: string, messageQueue: MessageQueue) {
    const toolChannel = `${this.slug}:${session}`
    const io = new IO(messageQueue, toolChannel)
    this.handler({ io })
      .then(() => {})
      .catch((error) => {})
  }
}

function generateId(): string {
  throw new NotImplementedError()
}

function slugify(str: string): string {
  throw new NotImplementedError()
}

class NotImplementedError extends Error {
  name = 'NotImplementedError'
}

const baseFieldSchema = z.object({
  required: z.boolean().optional(),
  label: z.string(),
})
const fieldSchema = z.discriminatedUnion('type', [
  baseFieldSchema.extend({
    type: z.literal('TEXT_INPUT'),
  }),
])
type Field = z.infer<typeof fieldSchema>

const fieldDataSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('TEXT_INPUT'),
    value: z.string(),
  }),
])
type FieldData = z.infer<typeof fieldDataSchema>

const baseMessageSchema = z.object({ id: z.string(), timestamp: z.number() })
const messageSchema = z.discriminatedUnion('type', [
  baseMessageSchema.extend({
    type: z.literal('RENDER_INPUT_FORM'),
    form: z.record(z.string(), fieldSchema),
  }),
  baseMessageSchema.extend({
    type: z.literal('INPUT_FORM_RESPONSE'),
    parentMessageId: z.string(),
    data: z.record(z.string(), fieldDataSchema),
  }),
])
type Message = z.infer<typeof messageSchema>
