/* this is the main file */

const {
  default: RhodvickConnect,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeInMemoryStore,
  downloadContentFromMessage,
  jidDecode,
  proto,
  getContentType,
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const { Boom } = require("@hapi/boom");
const fs = require("fs");
const FileType = require("file-type");
const { exec, spawn, execSync } = require("child_process");
const axios = require("axios");
const chalk = require("chalk");
const figlet = require("figlet");
const express = require("express");
const app = express();
const port = process.env.PORT || 10000;
const _ = require("lodash");
const PhoneNumber = require("awesome-phonenumber");
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require('./lib/exif');
const { isUrl, generateMessageTag, getBuffer, getSizeMedia, fetchJson, await, sleep } = require('./lib/botFunctions');
const store = makeInMemoryStore({ logger: pino().child({ level: "silent", stream: "store" }) });

const authenticationn = require('./auth.js');
const { smsg } = require('./smsg');

const { autoview, autoread, botname, autobio, mode, prefix, autoreact, presence, autolike, anticall } = require('./settings');
const { DateTime } = require('luxon');
const { commands, totalCommands } = require('./commandHandler');
authenticationn();
const groupEvents = require("./groupEvents.js");
// const connectionEvents = require("./connectionEvents.js");

async function startRhodvick() {

  const { saveCreds, state } = await useMultiFileAuthState(`session`)
  const client = rhodvickConnect({
    logger: pino({ level: 'silent' }),
    printQRInTerminal: true,
    version: [2, 3000, 1015901307],
    browser: [`RHODVICK-MD`, 'Safari', '3.0'],
    fireInitQueries: false,
    shouldSyncHistoryMessage: true,
    downloadHistory: true,
    syncFullHistory: true,
    generateHighQualityLinkPreview: true,
    markOnlineOnConnect: true,
    keepAliveIntervalMs: 30000,
    auth: state,
    getMessage: async (key) => {
      if (store) {
        const mssg = await store.loadMessage(key.remoteJid, key.id);
        return mssg.message || undefined;
      }
      return { conversation: "HERE" };
    }
  });
  
 const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Track the last text time to prevent overflow
let lastTextTime = 0;
const messageDelay = 5000; // Set the minimum delay between messages (in milliseconds)

client.ev.on('call', async (callData) => {
  if (anticall === 'true') {
    const callId = callData[0].id;
    const callerId = callData[0].from;
    
    // Reject the call
    await client.rejectCall(callId, callerId);

    // Check if enough time has passed since the last message
    const currentTime = Date.now();
    if (currentTime - lastTextTime >= messageDelay) {
      // Send the rejection message if the delay has passed
      await client.sendMessage(callerId, {
        text: '```❗📵I AM RHODVICK MD | I REJECT THIS CALL BECAUSE MY OWNER IS BUSY. KINDLY SEND TEXT INSTEAD```.',
      });

      // Update the last text time
      lastTextTime = currentTime;
    } else {
      console.log('Message skipped to prevent overflow');
    }
  }
});

if (autoreact === 'true') {
  client.ev.on("messages.upsert", async (chatUpdate) => {
    try {
      const mek = chatUpdate.messages[0];  // Assuming 'messages' is an array of messages
      if (!mek || !mek.message) return;

      const emojiFilePath = path.resolve(__dirname, 'database', 'emojis.json');
      let emojis = [];

      // Ensure emojis file exists and is valid
      try {
        const data = fs.readFileSync(emojiFilePath, 'utf8');
        emojis = JSON.parse(data);  // Parse the JSON data into an array
      } catch (error) {
        console.error('Error reading emojis file:', error);
        return;
      }

      // Process the message to react with a random emoji
      if (!mek.key.fromMe && emojis.length > 0) {
        const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
        await client.sendMessage(mek.key.remoteJid, {
          react: {
            text: randomEmoji,
            key: mek.key,
          },
        });
      }

    } catch (error) {
      console.error('Error processing message:', error);
    }
  });
}
 
  if (autobio === 'true') {
    setInterval(() => {
      const date = new Date();
      client.updateProfileStatus(
        `${botname} is active 24/7\n\n${date.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' })} It's a ${date.toLocaleString('en-US', { weekday: 'long', timeZone: 'Africa/Nairobi' })}.`
      );
    }, 10 * 1000);
  }

  client.ev.on("messages.upsert", async (chatUpdate) => {
    try {
      mek = chatUpdate.messages[0];
      if (!mek.message) return;
      mek.message = Object.keys(mek.message)[0] === "ephemeralMessage" ? mek.message.ephemeralMessage.message : mek.message;

      if (autoview === 'true' && autolike === 'true' && mek.key && mek.key.remoteJid === "status@broadcast") {
        const rhodvicklike = await client.decodeJid(client.user.id);
        await client.sendMessage(mek.key.remoteJid, { react: { key: mek.key, text: '💎' } }, { statusJidList: [mek.key.participant, rhodvicklike] });
      }

      if (autoview === 'true' && mek.key && mek.key.remoteJid === "status@broadcast") {
        await client.readMessages([mek.key]);
      } else if (autoread === 'true' && mek.key && mek.key.remoteJid.endsWith('@s.whatsapp.net')) {
        await client.readMessages([mek.key]);
      }

      if (mek.key && mek.key.remoteJid.endsWith('@s.whatsapp.net')) {
        const Chat = mek.key.remoteJid;
        if (presence === 'online') {
          await client.sendPresenceUpdate("available", Chat);
        } else if (presence === 'typing') {
          await client.sendPresenceUpdate("composing", Chat);
        } else if (presence === 'recording') {
          await client.sendPresenceUpdate("recording", Chat);
        } else {
          await client.sendPresenceUpdate("unavailable", Chat);
        }
      }

      if (!client.public && !mek.key.fromMe && chatUpdate.type === "notify") return;

      m = smsg(client, mek, store);
      require("./rhodvick")(client, m, chatUpdate, store);
    } catch (err) {
      console.log(err);
    }
  });

  // Handle error
  const unhandledRejections = new Map();
  process.on("unhandledRejection", (reason, promise) => {
    unhandledRejections.set(promise, reason);
    console.log("Unhandled Rejection at:", promise, "reason:", reason);
  });
  process.on("rejectionHandled", (promise) => {
    unhandledRejections.delete(promise);
  });
  process.on("Something went wrong", function (err) {
    console.log("Caught exception: ", err);
  });

  // Setting
  client.decodeJid = (jid) => {
    if (!jid) return jid;
    if (/:\d+@/gi.test(jid)) {
      let decode = jidDecode(jid) || {};
      return (decode.user && decode.server && decode.user + "@" + decode.server) || jid;
    } else return jid;
  };

  client.getName = (jid, withoutContact = false) => {
    id = client.decodeJid(jid);
    withoutContact = client.withoutContact || withoutContact;
    let v;
    if (id.endsWith("@g.us"))
      return new Promise(async (resolve) => {
        v = store.contacts[id] || {};
        if (!(v.name || v.subject)) v = client.groupMetadata(id) || {};
        resolve(v.name || v.subject || PhoneNumber("+" + id.replace("@s.whatsapp.net", "")).getNumber("international"));
      });
    else
      v =
        id === "0@s.whatsapp.net"
          ? {
              id,
              name: "WhatsApp",
            }
          : id === client.decodeJid(client.user.id)
          ? client.user
          : store.contacts[id] || {};
    return (withoutContact ? "" : v.name) || v.subject || v.verifiedName || PhoneNumber("+" + jid.replace("@s.whatsapp.net", "")).getNumber("international");
  };

  client.public = true;

  client.serializeM = (m) => smsg(client, m, store);

  client.ev.on("group-participants.update", async (m) => {
    groupEvents(client, m);
  });

  client.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "close") {
      let reason = new Boom(lastDisconnect?.error)?.output.statusCode;
      if (reason === DisconnectReason.badSession) {
        console.log(`Bad Session File, Please Delete Session and Scan Again`);
        process.exit();
      } else if (reason === DisconnectReason.connectionClosed) {
        console.log("Connection closed, reconnecting....");
        startRhodvick();
      } else if (reason === DisconnectReason.connectionLost) {
        console.log("Connection Lost from Server, reconnecting...");
        startRhodvick();
      } else if (reason === DisconnectReason.connectionReplaced) {
        console.log("Connection Replaced, Another New Session Opened, Please Restart Bot");
        process.exit();
      } else if (reason === DisconnectReason.loggedOut) {
        console.log(`Device Logged Out, Please Delete File creds.json and Scan Again.`);
        process.exit();
      } else if (reason === DisconnectReason.restartRequired) {
        console.log("Restart Required, Restarting...");
        startRhodvick();
      } else if (reason === DisconnectReason.timedOut) {
        console.log("Connection TimedOut, Reconnecting...");
        startRhodvick();
      } else {
        console.log(`Unknown DisconnectReason: ${reason}|${connection}`);
        startRhodvick();
      }
    } else if (connection === "open") {

      await client.groupAcceptInvite("KVkQtTxS6JA0Jctdsu5Tj9");

      console.log(`✅ Connection successful\nLoaded ${totalCommands} commands.\nBot is active.`);

      const getGreeting = () => {
        const currentHour = DateTime.now().setZone('Africa/Nairobi').hour;

        if (currentHour >= 5 && currentHour < 12) {
          return 'Good morning 🌄';
        } else if (currentHour >= 12 && currentHour < 18) {
          return 'Good afternoon ☀️';
        } else if (currentHour >= 18 && currentHour < 22) {
          return 'Good evening 🌆';
        } else {
              return 'Good night 😴';
            }
        };


        const getCurrentTimeInNairobi = () => {
            return DateTime.now().setZone('Africa/Nairobi').toLocaleString(DateTime.TIME_SIMPLE);
        };

        let message = `Hi, ${getGreeting()},\n\n╭═══『RHODVICK MD 𝐢𝐬 𝐜𝐨𝐧𝐧𝐞𝐜𝐭𝐞𝐝』══⊷ \n`;

        message += `║ ʙᴏᴛ ɴᴀᴍᴇ ${botname}\n`;
message += `║ ᴍᴏᴅᴇ ${mode}\n`;
message += `║ ᴘʀᴇғɪx [  ${prefix} ]\n`;

message += `║ ᴛᴏᴛᴀʟ ᴘʟᴜɢɪɴs ${totalCommands}\n`
        message += '║ ᴛɪᴍᴇ ' + getCurrentTimeInNairobi() + '\n';
        message += '║ ʟɪʙʀᴀʀʏ Baileys\n';

message += `╰═════════════════⊷`




            await client.sendMessage(client.user.id, { text: message });
        }




  });

  client.ev.on("creds.update", saveCreds);


  client.sendText = (jid, text, quoted = "", options) => client.sendMessage(jid, { text: text, ...options }, { quoted });

    client.downloadMediaMessage = async (message) => { 
         let mime = (message.msg || message).mimetype || ''; 
         let messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0]; 
         const stream = await downloadContentFromMessage(message, messageType); 
         let buffer = Buffer.from([]); 
         for await(const chunk of stream) { 
             buffer = Buffer.concat([buffer, chunk]) 
         } 

         return buffer 
      }; 


       

 client.downloadAndSaveMediaMessage = async (message, filename, attachExtension = true) => { 
         let quoted = message.msg ? message.msg : message; 
         let mime = (message.msg || message).mimetype || ''; 
         let messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0]; 
         const stream = await downloadContentFromMessage(quoted, messageType); 
         let buffer = Buffer.from([]); 
         for await(const chunk of stream) { 
             buffer = Buffer.concat([buffer, chunk]); 
         } 
         let type = await FileType.fromBuffer(buffer); 
         const trueFileName = attachExtension ? (filename + '.' + type.ext) : filename; 
         // save to file 
         await fs.writeFileSync(trueFileName, buffer); 
         return trueFileName; 
     };

}





app.use(express.static('public'));

app.get("/", (req, res) => {
    res.sendFile(__dirname + '/index.html'); 
});


app.listen(port, () => console.log(`Server listening on port http://localhost:${port}`));

startRhodvick();


module.exports = startRhodvick;

let file = require.resolve(__filename);
fs.watchFile(file, () => {
  fs.unwatchFile(file);
  console.log(chalk.redBright(`Update ${__filename}`));
  delete require.cache[file];
  require(file);
});