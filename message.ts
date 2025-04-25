import { z } from 'zod'

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
export const messageSchema = z.discriminatedUnion('type', [
  baseMessageSchema.extend({
    type: z.literal('START_TOOL'),
    session: z.string(),
  }),
  baseMessageSchema.extend({
    type: z.literal('START_TOOL_SUCCESS'),
    parentMessageId: z.string(),
  }),
  baseMessageSchema.extend({
    type: z.literal('START_TOOL_FAILURE'),
    parentMessageId: z.string(),
  }),
  baseMessageSchema.extend({
    type: z.literal('RECONNECT_TOOL_SESSION'),
    session: z.string(),
  }),
  baseMessageSchema.extend({
    type: z.literal('RENDER_INPUT_FORM'),
    form: z.record(z.string(), fieldSchema),
  }),
  baseMessageSchema.extend({
    type: z.literal('INPUT_FORM_RESPONSE'),
    parentMessageId: z.string(),
    data: z.record(z.string(), fieldDataSchema),
  }),
  // TODO: Add input form response success and error messages
  baseMessageSchema.extend({
    type: z.literal('INPUT_FORM_CANCELLATION'),
    parentMessageId: z.string(),
  }),
  // TODO: Add cancellation success and error messages
  baseMessageSchema.extend({
    type: z.literal('TOOL_COMPLETION'),
    output: z.unknown(),
  }),
  baseMessageSchema.extend({
    type: z.literal('TOOL_ERROR'),
    errorMessage: z.string(),
  }),
])
export type Message = z.infer<typeof messageSchema>

export function serializeMessage(msg: Message) {
  return JSON.stringify(msg)
}

export function deserializeMessage(str: string) {
  try {
    const json = JSON.parse(str)
    return messageSchema.parse(json)
  } catch {
    return undefined
  }
}
