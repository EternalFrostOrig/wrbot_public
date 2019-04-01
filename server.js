// Constants
const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');
const Eris = require("eris");
const shorthand = {"4TDM": "4 TDM", "2TDM": "2 TDM", FFA: "FFA", ODOM: "Open Maze Domination", MAZE: "Maze", "4DOM": "4 Team Domination", "2DOM": "2 Team Domination", PTDM: "Portal 4TDM", MOT: "Mothership/Maze Mothership", OTDM: "Open 3/4 TDM"}

var http = require('http');

//create a server object:
http.createServer(function (req, res) {
  res.write('All fine'); //write a response to the client
  res.end(); //end the response
}).listen(process.env.PORT || 3000); //the server object listens on port

const sheet_id = '1HDQtELScci0UlVR4ESnvhM6V8bgAtNX8GI3pzq7cG8M' // Sheet ID
// To get sheet ID, get the string after /u/<number>/ and before /edit

// Adds commas to numbers
function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}


// Breaks data into readable sections
var chunk = (array, elementPerChunk) => {
  let out = []
  for (let i = 0; i < array.length; i += elementPerChunk) {
    let temp = []
    for (let j = 0; j < elementPerChunk; j++) {
      temp.push(array[i + j])
    }
    out.push(temp)
  }
  return out
}

// Generate discord embed
function embed_gen(tankmode, score, name, proof, username) {
  return {
      embed: {
          title: tankmode,
          color: 0x8abc3f, // Color, either in hex (shown), or a base-10 integer
          fields: [
              {
                  name: "__Score__",
                  value: score,
                  inline: true
              },
              {
                  name: "__Held By__",
                  value: name,
                  inline: true
              },
              {
                  name: "__Proof__",
                  value: proof
              }
          ],
          footer: {
              text: "Requested by " + username
          }
      }
  }
}

var holders = {}

// Big function that updates holder data
// NOTE: actual flow is commented in getData function
function allTheStuff(name) {
  
  console.log("Updating player data...")
  
  let done = false

  // If modifying these scopes, delete token.json.
  const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
  // The file token.json stores the user's access and refresh tokens, and is
  // created automatically when the authorization flow completes for the first
  // time.
  const TOKEN_PATH = 'token.json';

  // Load client secrets from a local file.

  function run() {
    fs.readFile('credentials.json', (err, content) => {
      if (err) return console.log('Error loading client secret file:', err);
      // Authorize a client with credentials, then call the Google Sheets API.
      return authorize(JSON.parse(content), getData);
    });
  }

  /**
   * Create an OAuth2 client with the given credentials, and then execute the
   * given callback function.
   * @param {Object} credentials The authorization client credentials.
   * @param {function} callback The callback to call with the authorized client.
   */
  function authorize(credentials, callback) {
    const {client_secret, client_id, redirect_uris} = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0]);

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, (err, token) => {
      if (err) return getNewToken(oAuth2Client, callback);
      oAuth2Client.setCredentials(JSON.parse(token));
      return callback(oAuth2Client);
    });
  }

  /**
   * Get and store new token after prompting for user authorization, and then
   * execute the given callback with the authorized OAuth2 client.
   * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
   * @param {getEventsCallback} callback The callback for the authorized client.
   */
  function getNewToken(oAuth2Client, callback) {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });
    console.log('Authorize this app by visiting this url:', authUrl);
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question('Enter the code from that page here: ', (code) => {
      rl.close();
      oAuth2Client.getToken(code, (err, token) => {
        if (err) return console.error('Error while trying to retrieve access token', err);
        oAuth2Client.setCredentials(token);
        // Store the token to disk for later program executions
        fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
          if (err) console.error(err);
          console.log('Token stored to', TOKEN_PATH);
        });
        callback(oAuth2Client);
      });
    });
  }

  // Does all the fancy stuff
  function getData(auth) {
    const sheets = google.sheets({version: 'v4', auth});
    sheets.spreadsheets.values.get({
      spreadsheetId: sheet_id,
      "range": "Discord IDs!A1:C",
      "majorDimension": "ROWS"
    }, (err, res) => {
      // Here we have the data from the "Discord IDs" sheet
      if (err) return console.log('The API returned an error: ' + err);
      const rows = res.data.values;
      if (rows.length) {
        let i = 1
        rows.map((row) => {
          if (row.length == 2) { // Makes sure "Not in server" and "deleted account" dont get parsed in
            row[0] = row[0].toLowerCase()
            holders[row[0]] = {id: row[1], count: 0, score: 0, highest: 0}
          } else if (row.length > 2) { // put them in the no discord section
            row[0] = row[0].toLowerCase()
            holders[row[0]] = {id: "N/A", count: 0, score: 0, highest: 0}
          }
        });
        sheets.spreadsheets.values.get({
          spreadsheetId: sheet_id,
          "range": "Records!C14:AF",
          "majorDimension": "ROWS"
        }, (err, res) => {
          // Now we have the data from the records sheet
          if (err) return console.log('The API returned an error: ' + err);
          const rows = res.data.values;
          if (rows.length) {
            let i = 1
            let count = 0
            rows.map((row) => {
              let parts = chunk(row, 3) // puts every 3 items in an array
              parts.map((r_chunk) => {
                if (r_chunk[1]) {
                  r_chunk[1] = r_chunk[1].toLowerCase()
                  if (holders[r_chunk[1]]) { // Check if the name exists in our list of holders
                    holders[r_chunk[1]].count += 1 //  If so, increase the wr count by one and...
                    let num = parseFloat(r_chunk[0]),
                        ismil = r_chunk[0].includes('mil') // These get a number and a boolean saying if its a million or thousand
                    if (ismil) {
                      holders[r_chunk[1]].score += (num * 1000000) // if its a millions score, add the number times a million to the total score
                      if (num * 1000000 > holders[r_chunk[1]].highest) holders[r_chunk[1]].highest = Math.trunc(num * 1000000)
                    } else {
                      holders[r_chunk[1]].score += (num * 1000) // if its thousands, add the number times a thousand
                      if (num * 1000 > holders[r_chunk[1]].highest) holders[r_chunk[1]].highest = Math.trunc(num * 1000)
                    }
                  }
                }
              })
              done = true // Tell the rest of the code everything is done
            });
          } else {
            console.log('No data found.');
          }
        })
      } else {
        console.log('No data found.');
      }
    })
    console.log("Done processing")
  }
  run()
}
allTheStuff()
setInterval(allTheStuff, 500000)

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = 'token.json';

// Load client secrets from a local file.

function run(tank, mode, id, user, type) {
  fs.readFile('credentials.json', (err, content) => {
    if (err) return console.log('Error loading client secret file:', err);
    // Authorize a client with credentials, then call the Google Sheets API.
    authorize(JSON.parse(content), getData, tank.toLowerCase(), mode, id, user, type);
  });
}

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback, tank, mode, id, user, type) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) {
      bot.createMessage(id, "<@!345346351875358721> You dumbass you forgot to attach the token.json file\n\n(Im broken right now please try again later)")
      return getNewToken(oAuth2Client, callback);
    }
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client, tank, mode, id, user, type);
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getNewToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error while trying to retrieve access token', err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

function getData(auth, tank, mode, id, username, type) {
  console.log(type, tank, mode)
  var channel_id = id
  const sheets = google.sheets({version: 'v4', auth}); // Init sheets API
  if (type == "Record") {
    let data = {}
    sheets.spreadsheets.values.get({ // Get values...
      spreadsheetId: sheet_id, // From this google sheet
      "range": "Records!C1:AF1", // On this sheet, in range C1 to AF1
      "majorDimension": "ROWS" // Send up rows
    }, (err, res) => {
      if (err) return console.log('The API returned an error: ' + err);
      const rows = res.data.values;
      if (rows.length) { // If we actiually got data...
        let i = 1
        rows.map((row) => {
          row.forEach(function(datapoint) {
            if (datapoint != '' && !datapoint.includes('<')) {
              let name = datapoint.trim() // Figure out where our modes are on the sheet
              data[name] = i
              i += 1
            }
          })
        });
      } else {
        console.log('No data found.');
      }
      sheets.spreadsheets.values.get({ // Get data
        spreadsheetId: sheet_id, // On this google sheet
        "range": "Records!B13:AF", // On the "Records" sheet from range B13 to AF* (last row)
      }, (err, res) => {
        if (err) return console.log('The API returned an error: ' + err);
        const rows = res.data.values;
        if (rows.length) {
          let i = 4,
              none = true,
              search = tank

          if (search == 'basic') search = '(basic) tank' // Stored diffrently in sheet

          rows.map(([tank, ...row]) => { // For each tank/label
            if (tank) {
              if (tank.toLowerCase() == search) { // check if this is the right label
                none = false
                let wrs = chunk(row, 3)
                
                mode = shorthand[mode] // Get full mode name
                
                let wrdata = wrs[data[mode] - 1] // map mode name to chunk ID and save the data from that ID
                
                if (wrs.length == 0) { // If theres no records yet (at all)
                  bot.createMessage(channel_id, "No data yet, be the first!")
                } else if (wrdata !== undefined) { // If there is data
                  let score = wrdata[0] || "None"
                  let name = wrdata[1] || "No One"
                  let proof = wrdata[2] ? "<" + wrdata[2] + ">" : "N/A"
                  bot.createMessage(channel_id, embed_gen(tank + ", " + mode, score, name, proof, username))
                } else {
                  bot.createMessage(channel_id, "Unable to pull scores, are you sure you have a valid mode?")
                }
              }
            }
          });
          if (none) {
            bot.createMessage(channel_id, "Unable to find tank, are you sure you spelled the tank correctly?")
            console.log(search)
          }
        } else {
          return 'No data found.'
        }
      });
    })
  } else if (type == "Submissions") {
    sheets.spreadsheets.values.get({
      spreadsheetId: sheet_id,
      "range": "Submissions!A4:F",
    }, (err, res) => {
      if (err) return console.log('The API returned an error: ' + err);
      const rows = res.data.values;
      if (rows.length) {
        let i = 0
        rows.map((row) => {
          if (row[1] == '~') {
            i++
          }
        });
        if (i==0) {
          bot.createMessage(channel_id, "No pending submissions")
        } else {
          bot.createMessage(channel_id, String(i) + " pending submissions")
        }
      } else {
        console.log('No data found.');
      }
    });
  }
}

var bot = new Eris.CommandClient(process.env.bot_token, {}, {
    description: "A bot for getting Arras world records",
    owner: "EternalFrost#0955",
    prefix: process.env.prefix
});

bot.on("ready", () => { // When the bot is ready
    console.log("Ready!"); // Log "Ready!"
});

bot.registerCommandAlias("halp", "help");

bot.registerCommand("ping", "Pong!", {
    description: "Pong!",
    fullDescription: "This command could be used to check if the bot is up. Or entertainment when you're bored."
});

bot.registerCommand("get", (msg, args) => { // Make an echo command
    // tank, mode, id, user, type
    if (args.length == 2) {
      run(args[0], args[1].toUpperCase(), msg.channel.id, msg.author.username + "#" + msg.author.discriminator, "Record")
    } else if (args.length == 3) {
      run(args[0] + " " + args[1], args[2].toUpperCase(), msg.channel.id, msg.author.username + "#" + msg.author.discriminator, "Record")
    } else {
      return "Incorect amount of arguments!"
    }
}, {
    description: "Look up a world record",
    fullDescription: "Bot will get the world record for the tank and mode specified. (user wr!short for a list of modes)",
    usage: "<tank> <mode>"
});

bot.registerCommand("submissions", (msg, args) => {
  run("N/A", "N/A", msg.channel.id, "N/A", "Submissions")
}, {
    description: "Returns how many pending submissions there are",
    fullDescription: "Returns how many pending submissions there are.",
})

bot.registerCommand("stats", (msg, args) => {
  let name = args.join(" ")
  name = name.toLowerCase()
  let data = holders[name]
  if (data !== undefined) {
    let out = ''
    if (data.id !== "N/A") {
      let user = msg.channel.guild.members.get(data.id)
      if (data.id == msg.author.id) {
        out += "Your stats:\n"
      } else {
        out += user.username + "#" + user.discriminator + "'s stats:\n"
      }
    } else {
      out += name + "\n"
    }
    
    out += "Records: " + data.count + "\n"
    out += "Total Score: " + numberWithCommas(data.score) + "\n"
    out += "Highest Record (Aprox): " + numberWithCommas(data.highest)
    
    return out
  } else {
    return "Couldn't find stats, this can happen if they have left the community server, they deleted their account, or you spelled the submission name wrong."
  }
}, {
  description: "Get stats about a world record holder",
  fullDescription: "Gets stats about a world record holder",
  usage: "<submission name>"
})

bot.registerCommand('short', (msg, args) => {
  let sdata = JSON.stringify(shorthand)
  sdata = sdata.replace('{', '').replace('}', '')
  for (let i = 0; i < sdata.length / 3; i++) {
    sdata = sdata.replace('"', '')
    sdata = sdata.replace(',', '\n**')
    sdata = sdata.replace(':', '** -> ')
  }

  sdata = "**" + sdata
  
  return sdata
}, {
  description: "Gives list of modes",
  fullDescription: "Give the list of modes used for the get command"
})

bot.registerCommand("js", (msg, args) => { // Make an echo command
    if (msg.author.id === '345346351875358721') {
      try {
        let code = args.join(" ")
        console.log(code)
        return eval(code)
        } catch(e) {
          return JSON.stringify(e.message)
        }
    } else {
      return "haha no"
    }
}, {
    description: "Evaluates JavaScript (Requires bot owner)",
    fullDescription: "Bot will evaluate the passed javascript, duh.",
    usage: "<js>"
});

bot.connect();

bot.editStatus('online', {
  name: process.env.prefix + 'help',
  type: 0
});