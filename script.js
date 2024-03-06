/********************************************************
 *
 * Script Author:      	William Mills
 *                    	Technical Solutions Specialist
 *                    	wimills@cisco.com
 *                    	Cisco Systems
 *
 * Version: 1-0-0
 * Released: 03/05/24
 *
 * This is an example Webex Device macro which lets you control a
 * WebView Web App on your Webex Device from an in room touch controller.
 *
 * Demo WebApps:
 * - Tetris:
 *   The classic tetris controlled using a UI Extension Navigation Widget
 * - YouTube:
 *   Embedded YouTube player with UI Extension playback controls
 * - Vimoe:
 *   Embedded Vimeo player with UI Extension playback controls
 * - Whiteboard:
 *   Simply whiteboard Web App which mirrors drawings on the Room Navigator
 *   and the Webex Devices main display
 *
 * Full Readme, source code and license agreement available on Github:
 * https://github.com/wxsd-sales/webview-websocket-control-macro
 *
 ********************************************************/

/********************************************************
 * DivicePlayerControls:
 * This Class manages the setting up of the JSxAPI Connection
 * and Vimeo Player API controls.
 * 
 * 
 ********************************************************/

class DevicePlayerControl {
  #status; // Store Status Element
  #statusTimer; // Store Status Visibility Timer

  #player; // Store Player Div Element
  #xapi; // Store JSxAPI Connection
  #panelId; // Base UI Extension Panel

  #title; // Title of video
  #ticker; // Interval for updating slider
  #duration; // Video Duration
  #playRate;
  #currentTime;

  // Create JSxAPI Connection and Vimeo Player and listen to events
  constructor(parameters, player, status) {

    console.log("Starting Device Player Controls");

    this.player = player;
    this.status = status;
    this.panelId = parameters.panelId;

    this.setStatus("normal", `Connecting to [${parameters.ipAddress}]`);

    // Make JSxAPI Connection
    jsxapi
      .connect(parameters.ipAddress, {
        username: parameters.username,
        password: parameters.password,
      })
      .on("error", (error) => {
        console.error("JSxAPI Error:", error);
        this.setStatus(
          "error",
          `Unable to connect to [${parameters.ipAddress}]`
        );
      })
      .on("ready", async (connection) => {
        // Store xAPI connection
        this.xapi = connection;

        // Update status for debugging
        this.setStatus("success", `Connected to [${parameters.ipAddress}]`);

        // Liste to Widget Events and System Volume changes
        this.xapi.Event.UserInterface.Extensions.Widget.Action.on(
          this.proccessWidgets.bind(this)
        );

        this.xapi.Status.Audio.VolumeMute.on(
          this.proccessVolumeMute.bind(this)
        );
        this.xapi.Status.Audio.Volume.on(this.proccessVolumeChange.bind(this));
      });

    const options = {
      width: window.innerWidth,
      height: window.innerHeight,
      url: parameters.link,
    };

    // Load Player and listen for events
    this.player = new Vimeo.Player("player", options);
    this.player.ready().then(this.processPlayerReady.bind(this));
    this.player.on("timeupdate", this.processTimeUpdate.bind(this));
  }

  /********************************************************
   *
   * Functions for handling UI Extension Events and Update
   *
   ********************************************************/

  // Process Widget Events
  async proccessWidgets(event) {
    const [panelId, category, action] = event.WidgetId.split("-");

    // Ignore Events from invalid Panels
    if (this.panelId != panelId) return;

    // Ignore Events from invalid Widgets
    if (category != "playercontrols") return;

    if (event.Type == "clicked") {
      switch (action) {
        case "playpause":
          this.playPause();
          break;
        case "stop":
          this.stopVideo();
          break;
        case "fastforward":
        case "fastback":
          this.changeRate(action);
          break;
        case "toggleMute":
          this.toggleVolume();
          break;
      }
    } else if (event.Type == "released") {
      switch (action) {
        case "systemVolume":
          this.setSystemVolume(parseInt(event.Value));
          break;

        case "playTime":
          this.setPlayTime(parseInt(event.Value));
          break;
      }
    }
  }

  toggleVolume() {
    console.log("Toggling Volume Mute");
    xapi.Command.Audio.Volume.ToggleMute();
  }

  proccessVolumeMute(state) {
    const newState = state == "On" ? "active" : "inactive";
    console.log("Setting Toggle Mute Widget to:", newState);
    this.xapi.Command.UserInterface.Extensions.Widget.SetValue({
      Value: newState,
      WidgetId: this.panelId + "-toggleMute",
    });
  }

  proccessVolumeChange(value) {
    const mappedValue = this.mapBetween(value, 0, 255, 0, 100);
    console.log("System Volume Changed to:", value);
    console.log("Setting UI Extension Volume slider to:", mappedValue);
    this.xapi.Command.UserInterface.Extensions.Widget.SetValue({
      Value: mappedValue,
      WidgetId: this.panelId + "-playercontrols-systemVolume",
    });
  }

  setSystemVolume(value) {
    const mappedValue = this.mapBetween(value, 0, 100, 0, 255);
    console.log("Setting System Volume to:", mappedValue);
    this.xapi.Command.Audio.Volume.Set({ Level: mappedValue });
  }

  async updatePlayTimeUI(seconds, duration) {
    const sliderValue = this.mapBetween(seconds, 0, 255, 0, duration);
    const currentTimeText = this.fmtMSS(Math.round(seconds));
    const durationTimeText = this.fmtMSS(Math.round(duration));
    const playTimeText = `[ ${currentTimeText} / ${durationTimeText} ]`;

    this.xapi.Command.UserInterface.Extensions.Widget.SetValue({
      Value: sliderValue,
      WidgetId: this.panelId + "-playercontrols-playTime",
    });

    this.xapi.Command.UserInterface.Extensions.Widget.SetValue({
      Value: playTimeText,
      WidgetId: this.panelId + "-playTime",
    });
  }

  async changeRate(direction) {
    const rates = [0.5, 0.75, 1, 1.25, 2];
    const currentSpeed = await this.player.getPlaybackRate();
    const index = rates.findIndex((rate) => rate == currentSpeed);

    if (direction == "fastforward" && index != rates.length - 1) {
      console.log("Changing Play Rate to:", rates[index + 1]);
      this.player.setPlaybackRate(rates[index + 1]);
    } else if (direction == "fastback" && index != 0) {
      console.log("Changing Play Rate to:", rates[index - 1]);
      this.player.setPlaybackRate(rates[index - 1]);
    } else {
      console.log(
        "Play Rate cannot be",
        direction == "fastforward" ? "increased" : "decreased"
      );
    }
  }

  async updateTitle() {
    const title = await this.player.getVideoTitle();
    this.xapi.Command.UserInterface.Extensions.Widget.SetValue({
      Value: `Title: ` + title,
      WidgetId: this.panelId + "-title",
    });
  }

  async setPlayTime(value) {
    this.duration = await this.player.getDuration();
    const newTime = this.mapBetween(parseInt(value), 0, this.duration, 0, 255);
    console.log("Setting new Play Time to:", newTime);
    this.player.setCurrentTime(newTime);
  }

  /********************************************************
   * Functions for handling Player Events and Controls
   ********************************************************/

  // When the Player is ready, update the UI Extension Title & Play Time
  async processPlayerReady() {
    console.log("Player Ready");
    const seconds = await this.player.getCurrentTime();
    const duration = await this.player.getDuration();
    await this.updatePlayTimeUI(seconds, duration);
    await this.updateTitle();
  }

  // Update the Play Time on the UI Extension Panel when playing
  processTimeUpdate(event) {
    this.updatePlayTimeUI(event.seconds, event.duration);
  }

  // Play / Pause the Video
  async playPause() {
    const playerPaused = await this.player.getPaused();
    if (playerPaused) {
      console.log("Playing Video");
      this.player.play();
    } else {
      console.log("Pausing Video");
      this.player.pause();
    }
  }

  // Stop Video: Pauses Video and Resets to Play Time 0 seconds
  stopVideo() {
    console.log("Stopping Video");
    this.player.pause();
    this.player.setCurrentTime(0);
  }

  /********************************************************
   * Miscellaneous Functions
   ********************************************************/

  // This function updates the Connection status notifications
  // on the top right corner of the Web App for Debugging
  setStatus(type, text) {
    // Set Status Text
    this.status.innerHTML = text;

    // Set Status Background Color and make visible
    const map = { success: "green", error: "red", normal: "grey" };
    this.status.style.background = map[type] ?? "grey";
    this.status.style.visibility = "visible";

    // Clear any previous timers
    if (this.statusTimer) clearTimeout(this.statusTimer);

    // Hide Status after 2 seconds
    this.statusTimer = setTimeout(() => {
      this.status.style.visibility = "hidden";
    }, 2000);
  }

  // Converts seconds to into minutes and seconds text
  // eg. 90 seconds = 01:30
  fmtMSS(s) {
    return (s - (s %= 60)) / 60 + (9 < s ? ":" : ":0") + s;
  }

  // Maps an inputed value from source range to target range
  // Used for mapping Widget Slider 0-255 to Play Time or Volume
  mapBetween(currentNum, minAllowed, maxAllowed, min, max) {
    return Math.round(
      ((maxAllowed - minAllowed) * (currentNum - min)) / (max - min) +
        minAllowed
    );
  }
}

/********************************************************
 * Miscellaneous Functions
 ********************************************************/

// If URL Hash Parameters are present, process them and connect
if (window.location.hash) {
  // Get URL Hash Parameters
  console.log(window.location.hash);
  const hash = window.location.hash.split("#").pop();

  // Decode and parse the Parameters
  const parameters = JSON.parse(window.atob(hash));

  // Verify all required paremeters are present
  const required = ["username", "password", "ipAddress", "panelId", "link"];
  let verified = true;
  for (let i = 0; i < required.length; i++) {
    if (required[i] in parameters) {
      console.log(
        `Hash Parameter [${required[i]}] = [${parameters[required[i]]}]`
      );
    } else {
      // If missing a parameter, don't load
      console.warn("Missing Hash Parameter:", required[i]);
      verified = false;
    }
  }

  const status = document.getElementById("status");
  const player = document.getElementById("player");

  if (verified) {
    const controller = new DevicePlayerControl(parameters, player, status);
  }
}
