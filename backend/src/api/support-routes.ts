// AeneasSoft Support Routes — support email with confirmation
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { sendSupportEmail, sendSupportConfirmation } from '../emails';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function registerSupportRoutes(fastify: FastifyInstance): Promise<void> {

  // POST /api/support — send support request (auth optional)
  fastify.post('/api/support', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      name?: string;
      email?: string;
      subject?: string;
      message?: string;
    };

    if (!body.name || body.name.length < 2) {
      return reply.status(400).send({ error: 'Name must be at least 2 characters' });
    }
    if (!body.email || !EMAIL_RE.test(body.email)) {
      return reply.status(400).send({ error: 'Valid email required' });
    }
    if (!body.subject || body.subject.length < 5) {
      return reply.status(400).send({ error: 'Subject must be at least 5 characters' });
    }
    if (!body.message || body.message.length < 20) {
      return reply.status(400).send({ error: 'Message must be at least 20 characters' });
    }

    try {
      await sendSupportEmail({
        name: body.name,
        email: body.email,
        subject: body.subject,
        message: body.message,
        userId: request.userId || undefined,
      });

      sendSupportConfirmation(body.email, body.name, body.message).catch((err) =>
        fastify.log.error({ err }, 'AeneasSoft Failed to send support confirmation')
      );

      return reply.send({ success: true, message: 'Support request sent' });
    } catch (err: any) {
      fastify.log.error({ err }, 'AeneasSoft Failed to send support email');
      return reply.status(500).send({ error: 'Failed to send support request' });
    }
  });
}
