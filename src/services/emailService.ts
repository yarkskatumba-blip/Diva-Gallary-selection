/**
 * Email notification service using EmailJS.
 * Sends real emails to divashotsstudios@gmail.com when:
 *   - A new gallery/collection is created
 *   - A client submits their photo selection
 *
 * Setup:
 *  1. Create a free account at https://www.emailjs.com
 *  2. Add a Gmail service connected to divashotsstudios@gmail.com
 *  3. Create an email template with variables: {{subject}}, {{message}}, {{to_email}}
 *  4. Copy your Service ID, Template ID, and Public Key into Admin → Settings
 */
import emailjs from '@emailjs/browser';

interface EmailParams {
  subject: string;
  message: string;
  serviceId: string;
  templateId: string;
  publicKey: string;
}

const STUDIO_EMAIL = 'divashotsstudios@gmail.com';

export async function sendStudioNotification(params: EmailParams): Promise<void> {
  const { subject, message, serviceId, templateId, publicKey } = params;

  if (!serviceId || !templateId || !publicKey) {
    // EmailJS not yet configured — silently skip (in-app notification still fires)
    console.info('[EmailJS] Not configured — skipping email. Set up in Admin → Settings.');
    return;
  }

  try {
    await emailjs.send(
      serviceId,
      templateId,
      {
        to_email: STUDIO_EMAIL,
        subject,
        message,
        studio_name: 'Diva Shots Studio'
      },
      publicKey
    );
    console.info('[EmailJS] Email sent successfully to', STUDIO_EMAIL);
  } catch (err) {
    // Never crash the app if email fails
    console.error('[EmailJS] Failed to send email:', err);
  }
}

export function buildGalleryCreatedEmail(clientName: string, collectionTitle: string, galleryUrl: string) {
  return {
    subject: `📸 New Gallery Created — ${clientName}`,
    message: `A new photo selection gallery has been created.\n\nClient: ${clientName}\nCollection: ${collectionTitle || 'Untitled'}\nGallery Link: ${galleryUrl}\n\nThe client can now access this link to begin selecting their photos.\n\n— Diva Shots Studio System`
  };
}

export function buildSelectionSubmittedEmail(
  clientName: string,
  collectionTitle: string,
  selectedCount: number,
  extraPhotos: number,
  extraAmount: number,
  currency: string
) {
  const extraLine = extraPhotos > 0
    ? `Extra Photos: ${extraPhotos} (+${currency} ${extraAmount.toLocaleString()})`
    : 'No extra photos selected.';

  return {
    subject: `✅ Selection Submitted — ${clientName}`,
    message: `${clientName} has submitted their photo selection!\n\nCollection: ${collectionTitle || 'Untitled'}\nPhotos Selected: ${selectedCount}\n${extraLine}\n\nLog in to your admin panel to review the selection.\n\n— Diva Shots Studio System`
  };
}
