const fs = require('fs');
const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
const express = require('express');
const http = require('http');
const url = require('url');

const SCOPES = ['https://www.googleapis.com/auth/youtube.upload'];
const TOKEN_PATH = 'token.json';
const CLIENT_SECRETS_PATH = './client_secrets.json';
const PORT = 3000;

const credentials = require(CLIENT_SECRETS_PATH);

const app = express();

const authorize = async () => {
  const { client_secret, client_id, redirect_uris } = credentials.web;
  const oAuth2Client = new OAuth2Client(client_id, client_secret, `http://localhost:${PORT}/oauth2callback`);

  try {
    const token = fs.readFileSync(TOKEN_PATH);
    oAuth2Client.setCredentials(JSON.parse(token));
    return oAuth2Client;
  } catch (err) {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });

    console.log('Authorize this app by visiting this URL:', authUrl);

    app.get('/auth', (req, res) => {
      res.redirect(authUrl);
    });

    app.get('/oauth2callback', async (req, res) => {
      const authorizationCode = req.query.code;

      const { tokens } = await oAuth2Client.getToken(authorizationCode);
      oAuth2Client.setCredentials(tokens);
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));

      console.log('Authorization successful. You can close this window.');

      res.send('Authorization successful. You can close this window.');
    });

    app.listen(PORT, () => {
      console.log(`Server listening on http://localhost:${PORT}`);
    });
  }
};

(async () => {
  const oAuth2Client = await authorize();

  const youtube = google.youtube({
    version: 'v3',
    auth: oAuth2Client,
  });

  const initializeUpload = async (options) => {
    const tags = options.keywords ? options.keywords.split(',') : [];

    const body = {
      snippet: {
        title: options.title || 'Test Title',
        description: options.description || 'Test Description',
        tags: tags,
        categoryId: options.category || '22',
      },
      status: {
        privacyStatus: options.privacyStatus || 'public',
      },
    };

    const media = {
      body: fs.createReadStream(options.file),
    };

    try {
      const res = await youtube.videos.insert({
        auth: oAuth2Client,
        part: Object.keys(body).join(','),
        media: media,
        resource: body,
      });

      if (res.data && res.data.id) {
        console.log(`Video id '${res.data.id}' was successfully uploaded.`);
      } else {
        console.error(`The upload failed with an unexpected response: ${res}`);
      }
    } catch (err) {
      console.error(`An error occurred: ${err.message}`);
    }
  };

  const options = {
    file: '/Users/niharrdg/code/nodeyt/sample.mp4',
    title: 'VideoMate Trail',
    description: 'Uploading our first video',
    category: '22',
    keywords: 'keyword1, keyword2',
    privacyStatus: 'private',
  };

  if (!fs.existsSync(options.file)) {
    console.error('Please specify a valid file using the --file parameter.');
  } else {
    await initializeUpload(options);
  }
})();
