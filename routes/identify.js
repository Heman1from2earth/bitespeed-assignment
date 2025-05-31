const express = require("express");
const router = express.Router();
const db = require("../db");

router.post("/identify", async (req, res) => {
  const { email, phoneNumber } = req.body;

  if (!email && !phoneNumber) {
    return res.status(400).json({ error: "email or phoneNumber is required" });
  }

  try {
    const [contacts] = await db.query(
      `SELECT * FROM Contact WHERE email = ? OR phoneNumber = ?`,
      [email, phoneNumber]
    );

    if (contacts.length === 0) {
      // No match: create a new primary contact
      const [result] = await db.query(
        `INSERT INTO Contact (email, phoneNumber, linkPrecedence, createdAt, updatedAt) VALUES (?, ?, 'primary', NOW(), NOW())`,
        [email, phoneNumber]
      );

      return res.json({
        contact: {
          primaryContatctId: result.insertId,
          emails: [email],
          phoneNumbers: [phoneNumber],
          secondaryContactIds: [],
        },
      });
    }

    // Resolve primary
    let primary =
      contacts.find((c) => c.linkPrecedence === "primary") || contacts[0];
    if (primary.linkedId) {
      const [primaryRow] = await db.query(
        `SELECT * FROM Contact WHERE id = ?`,
        [primary.linkedId]
      );
      if (primaryRow.length) primary = primaryRow[0];
    }

    const [allRelated] = await db.query(
      `SELECT * FROM Contact WHERE id = ? OR linkedId = ?`,
      [primary.id, primary.id]
    );

    const emails = [...new Set(allRelated.map((c) => c.email).filter(Boolean))];
    const phones = [
      ...new Set(allRelated.map((c) => c.phoneNumber).filter(Boolean)),
    ];
    const secondaryIds = allRelated
      .filter((c) => c.linkPrecedence === "secondary")
      .map((c) => c.id);

    const exists = allRelated.some(
      (c) => c.email === email && c.phoneNumber === phoneNumber
    );
    if (!exists) {
      // Insert new secondary if data is new
      await db.query(
        `INSERT INTO Contact (email, phoneNumber, linkPrecedence, linkedId, createdAt, updatedAt) VALUES (?, ?, 'secondary', ?, NOW(), NOW())`,
        [email, phoneNumber, primary.id]
      );
    }

    const [finalContacts] = await db.query(
      `SELECT * FROM Contact WHERE id = ? OR linkedId = ?`,
      [primary.id, primary.id]
    );

    const finalEmails = [
      ...new Set(finalContacts.map((c) => c.email).filter(Boolean)),
    ];
    const finalPhones = [
      ...new Set(finalContacts.map((c) => c.phoneNumber).filter(Boolean)),
    ];
    const finalSecondaryIds = finalContacts
      .filter((c) => c.linkPrecedence === "secondary")
      .map((c) => c.id);

    res.json({
      contact: {
        primaryContatctId: primary.id,
        emails: finalEmails,
        phoneNumbers: finalPhones,
        secondaryContactIds: finalSecondaryIds,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

module.exports = router;
