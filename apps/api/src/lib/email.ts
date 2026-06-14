import { Resend } from "resend";
import type { CreateEmailOptions } from "resend";
import { z } from "zod";
import type { Env } from "@/env";

export const BATCH_SIZE = 100; // Resend limit: https://resend.com/docs/api-reference/emails/send-batch-emails
export const recipientSchema = z.object({ email: z.string() }).passthrough();

/**
 * Creates a Resend email client from environment variables.
 */
export const createEmailClient = (env: Env) => new Resend(env.RESEND_API_KEY);

/**
 * Gets the default "from" address for emails.
 */
export const getDefaultFrom = (env: Env) => `Flexile <noreply@${env.EMAIL_DOMAIN}>`;

type EmailOptions = Omit<CreateEmailOptions, "from" | "html" | "text"> & {
  from?: string;
  html: string;
};

/**
 * Sends a single email using Resend.
 */
export const sendEmail = async (env: Env, email: EmailOptions) => {
  const resend = createEmailClient(env);
  const response = await resend.emails.send({ from: getDefaultFrom(env), ...email });
  if (response.error) throw new Error(`Resend error: ${response.error.message}`);
  return response;
};

/**
 * Sends batch emails using Resend, respecting the batch size limit.
 */
export const sendEmails = async (
  env: Env,
  options: Omit<EmailOptions, "to">,
  recipients: z.infer<typeof recipientSchema>[],
) => {
  const resend = createEmailClient(env);
  const defaultFrom = getDefaultFrom(env);
  const chunks: z.infer<typeof recipientSchema>[][] = [];

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    chunks.push(recipients.slice(i, i + BATCH_SIZE));
  }

  return Promise.all(
    chunks.map((batch) =>
      resend.batch
        .send(batch.map((recipient) => ({ from: defaultFrom, ...options, to: recipient.email })))
        .then((response) => {
          if (response.error) throw new Error(`Resend error: ${response.error.message}`);
        }),
    ),
  );
};
