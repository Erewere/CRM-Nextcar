const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

async function test() {
  const { data, error } = await resend.emails.send({
    from: `Nextcar CRM <contacto@nextcar.erewere.com>`,
    to: 'test@example.com',
    subject: 'Test',
    html: '<p>Test</p>'
  });
  console.log({ data, error });
}
test();
