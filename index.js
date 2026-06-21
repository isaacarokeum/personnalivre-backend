require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.raw({ type: 'application/json' }));

const transporter = nodemailer.createTransport({
  host: 'smtp-mail.outlook.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Webhook Lemon Squeezy — appelé automatiquement après chaque paiement
app.post('/webhook', async (req, res) => {
  try {
    // Vérifier la signature Lemon Squeezy
    const secret = process.env.LS_WEBHOOK_SECRET;
    const signature = req.headers['x-signature'];
    const hash = crypto.createHmac('sha256', secret).update(req.body).digest('hex');
    if (hash !== signature) {
      console.log('Signature invalide');
      return res.status(401).send('Unauthorized');
    }

    const payload = JSON.parse(req.body.toString());
    const eventName = payload.meta?.event_name;

    // On traite seulement les paiements réussis
    if (eventName !== 'order_created') {
      return res.status(200).send('OK');
    }

    const order = payload.data?.attributes;
    const custom = order?.first_order_item?.meta?.custom_data || {};
    const customer = {
      nom: order?.user_name || '—',
      email: order?.user_email || '—',
      total: ((order?.total || 0) / 100).toFixed(2) + ' €',
      produit: order?.first_order_item?.product_name || '—',
    };

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2 style="color:#2C1810;border-bottom:2px solid #C8A96E;padding-bottom:10px;">
          📚 Nouvelle commande Personnalivre !
        </h2>
        
        <h3 style="color:#5C4033;">👤 Client</h3>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:6px;color:#9C8070;width:40%">Nom</td><td style="padding:6px;font-weight:bold">${customer.nom}</td></tr>
          <tr style="background:#FDF8F2"><td style="padding:6px;color:#9C8070">Email</td><td style="padding:6px">${customer.email}</td></tr>
        </table>

        <h3 style="color:#5C4033;margin-top:20px;">📖 Commande</h3>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:6px;color:#9C8070;width:40%">Produit</td><td style="padding:6px;font-weight:bold">${customer.produit}</td></tr>
          <tr style="background:#FDF8F2"><td style="padding:6px;color:#9C8070">Type</td><td style="padding:6px">${custom.type || '—'}</td></tr>
          <tr><td style="padding:6px;color:#9C8070">Thème</td><td style="padding:6px">${custom.theme || '—'}</td></tr>
          <tr style="background:#FDF8F2"><td style="padding:6px;color:#9C8070">Pages</td><td style="padding:6px">${custom.pages || '—'}</td></tr>
          <tr><td style="padding:6px;color:#9C8070">Format</td><td style="padding:6px">${custom.format || '—'}</td></tr>
          <tr style="background:#FDF8F2"><td style="padding:6px;color:#9C8070">Personnages</td><td style="padding:6px">${custom.personnages || '—'}</td></tr>
          <tr><td style="padding:6px;color:#9C8070">Histoire</td><td style="padding:6px">${custom.histoire || '—'}</td></tr>
          <tr style="background:#FDF8F2"><td style="padding:6px;color:#9C8070">Pays livraison</td><td style="padding:6px">${custom.pays || '—'}</td></tr>
          <tr><td style="padding:6px;color:#9C8070">Adresse</td><td style="padding:6px">${custom.adresse || '—'}</td></tr>
        </table>

        <div style="margin-top:20px;background:#C8A96E;color:white;padding:15px 20px;border-radius:10px;font-size:18px;font-weight:bold;">
          💰 Total payé : ${customer.total}
        </div>

        <p style="color:#9C8070;font-size:12px;margin-top:20px;">
          Commande reçue via Personnalivre · ${new Date().toLocaleString('fr-FR')}
        </p>
      </div>
    `;

    await transporter.sendMail({
      from: `"Personnalivre" <${process.env.EMAIL_USER}>`,
      to: 'personnalivre@outlook.fr',
      subject: `📚 Nouvelle commande — ${customer.nom} — ${customer.produit}`,
      html,
    });

    console.log('Email envoyé pour commande de', customer.email);
    res.status(200).send('OK');
  } catch (err) {
    console.error('Erreur webhook:', err);
    res.status(500).send('Error');
  }
});

app.get('/', (req, res) => res.send('Personnalivre backend OK'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur démarré sur port ${PORT}`));
