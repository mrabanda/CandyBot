// This file runs the app in a setInterval() as sson as the file is executed

const fs = require('fs-extra');
//used to execute bash commands
const exec = require('child-process-promise').exec
const express = require('express')
const app = express();
const path = require('path')
const config = require('./config')

// CONFIGURE TWILIO
const accountSid = config.twilio.secret;
const authToken = config.twilio.authtoken;
const twilio = require('twilio');
const client = new twilio(accountSid, authToken);
const twilio_number = config.twilio.number;
const myNumber = config.twilio.myNumber;
const baseURL = config.twilio.baseURL;

// CONFIGURE CLARIFAI
// initialize with your clientId and clientSecret
const Clarifai = require('clarifai')
const clarifai = new Clarifai.App(
  config.clarifai.authtoken,
  config.clarifai.secret
);

//============================================================================================================
// MAIN APP LOGIC
//============================================================================================================

// app is immediately initialized and invoked periodically with setInterval
setInterval(runApp, 20000)

// initializes app
function runApp() {
  // set the file name to the current date
  const pictureName = `${Date.now()}.jpg`
  // save the picture taking command 'raspistill' to a variable 
  const takePicture = `raspistill -o public/${pictureName}`;
  //take picture with raspberry pi
  exec(takePicture)
    .then((error, stdout, stderr) => {
      // 'raspistill' doesn't return anything
      console.log("Took a picture!")
      // read the picture file that was just saved
      fs.readFile(`./public/${pictureName}`)
        .then((data) => {
          // converts file to base64 to send to clarifai
          convertedFile = new Buffer(data).toString('base64');
          // runs clarifai function with converted file
          clarifaiPredict(convertedFile)
        })
        .catch(err => console.error(err))
    })
    .catch(err => console.error(err))
}

// EXPRESS ROUTES, currently not used in this file
app.use('/static', express.static(path.join(__dirname, 'public')))

app.get('/', (req, res) => {
  console.log('Sending you to the page!');
  res.send('WELLCOME TO STRESS BOT');
})

app.get('/stressed', (req, res) => {
  res.send("Hey you're stressed, Take it easy")
})

app.listen(3000, () => {
  console.log('Example app listening on port 3000!')
})

// executes stress reliever code
function handleStress() {
  // this python script turns the servo motor for 1 second
  let candyScript = `python Adafruit-Raspberry-Pi-Python-Code/Adafruit_PWM_Servo_Driver/Servo_Example.py 1`;
  let text = "Hey you seem too have a lot on your plate, Maybe you should take a walk";
  let voice = "You are looking a bit stressed, Maybe you should take a walk"
  textMessage(text, myNumber);
  // voiceMessage(voice, myNumber);
  voiceSound(`${baseURL}/bob.mp3`, myNumber);
  // Dispense Candy!!!
  exec(candyScript);
}

//============================================================================================================
// CLARIFAI FUNCTIONS
//============================================================================================================
function clarifaiPredict(base64File) {
  clarifai.models.predict("StressTest", {base64: base64File})
    .then((response) => {
      let detected = response.outputs[0].data.concepts;
      console.log(detected.length);
      detected.map((element) => {
        if (element.name === 'Stress' && element.value >= .9) {
          console.log("Hey you're stressed, Take it easy");
          handleStress();
        } else if(element.name === 'NotStressed' && element.value >= .5) {
          console.log("All is well, keep on keeping those stress levels low!");
        }
        console.log("Name:", element.name);
        console.log("Value:", element.value);
      })
    })
    .catch(err => console.error(err))
}

//============================================================================================================
// TWILIO FUNCTIONS
//============================================================================================================

//sends a text messsage
function textMessage(message, pnumber) {
	client.messages.create({
  	body: message,
		to: pnumber,  // Text this number
		from: twilio_number // From a valid Twilio number
  })
	.then((message) => console.log(message.sid));
}
// sends customized voice message
function voiceMessage(message, pnumber) {
	let nurl = `${baseURL}/xmlText.php?message=${encodeURIComponent(message)}`;
	client.calls.create({
  	url: nurl,
  	to: pnumber,
  	from: twilio_number
	})
	.then((call) => process.stdout.write(call.sid));
}
// sends an mp3 message
function voiceSound(mp3url, pnumber) {
	let nurl = `${baseURL}/xmlSound.php?mp3url=${encodeURIComponent(mp3url)}`;

	client.calls.create({
		url: nurl,
		to: pnumber,
		from: twilio_number
	})
	.then((call) => process.stdout.write(call.sid));
}
//============================================================================================================