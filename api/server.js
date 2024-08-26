const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors'); // Import the cors package
const mongoose = require('mongoose');
require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MONGODB_URI = process.env.MONGODB_URI;

app.use(cors()); // Use the cors middleware


app.use(express.json());

// Connect to MongoDB
mongoose.connect(MONGODB_URI, { 
    useNewUrlParser: true, 
    useUnifiedTopology: true,
    useCreateIndex: true,
    useFindAndModify: false
})
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

// Define a schema and model for emails
const emailSchema = new mongoose.Schema({
    userId: String,
    inputEmail: String,
    rewrittenEmail: String,
    style: String,
    createdAt: { type: Date, default: Date.now }
});

const Email = mongoose.model('Email', emailSchema);

app.get('/api/styles', (req, res) => {
    const styles = ['pirate', 'limerick', 'shakespeare', 'haiku', 'sarcastic'];
    res.json({ styles });
});

app.post('/api/rewrite-email', async (req, res) => {
    console.log('Received request to rewrite email');
    const { inputEmail, style } = req.body;
    const userId = req.query.userid;
    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    const stylePrompts = {
        pirate: "Rewrite the following text in a pirate style:",
        limerick: "Rewrite the following text as a limerick:",
        shakespeare: "Rewrite the following text in the style of Shakespeare:",
        haiku: "Rewrite the following text as a haiku:",
        sarcastic: "Rewrite the following text in a sarcastic tone:"
    };

    const messages = [

        { role: "system", content: "You are an assistant that rewrites texts in different styles." },

        { role: "user", content: `${stylePrompts[style]}\n\n${inputEmail}\n\nRewritten text:` }

    ];

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: messages,
                max_tokens: 150,
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        const rewrittenEmail = data.choices[0].message.content.trim();

        // Save the input and output to the database
        try {
            const newEmail = new Email({ userId, inputEmail, rewrittenEmail, style });
            await newEmail.save();
            console.log('Email saved to database:', newEmail);
        } catch (saveError) {
            console.error('Error saving to database:', saveError);
        }

        res.json({ rewrittenEmail });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'An error occurred while rewriting the email. Please try again.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
