/********************************************************
 *
 * Macro Author:      	William Mills
 *                    	Technical Solutions Specialist
 *                    	wimills@cisco.com
 *                    	Cisco Systems
 *
 * Version: 1-0-0
 * Released: 03/06/24
 *
 * This example macro lets you display a list of Vimeo links on
 * your Cisco Room Navigator of Touch 10" controller. Users can
 * open the links and have them displayed on the main display
 * of the paired Cisco Board or Room System.
 *
 * The uses can also control the Vimeo video playback while it
 * is visible on the main display.
 *
 * This macro requires a companion web app to load the Vimeo link
 * as an embedded video. The web app also handles the playback
 * control of the Vimeo embedded by listening to the UI Extension
 * player controls on the controller.
 *
 * The companion web app is available on GitHub pages to use with this
 * macro immedically for Vimeo videos enabled for Embedding on any domain.
 *
 * If you have Vimeos videos which are restricted to
 * specific domains, then you can download the companion web app
 * and host it on a web server with and approved domain.
 *
 * Note: Private and Password Protected Vimeo videos are not supported.
 *
 * Full Readme, source code and license agreement available on Github:
 * https://github.com/wxsd-sales/vimeo-control-macro
 *
 ********************************************************/

import xapi from "xapi";

/*********************************************************
 * Configure the settings below
 **********************************************************/

const config = {
  button: {
    name: "Vimeo Videos", // The main button name on the UI and its Panel Page Tile
    color: "#6F739E", // Color of the button
    icon: "Tv", // Specify which prebuilt icon you want. eg. Concierge | Tv
    title: "Tap To Open",
    showInCall: true,
    closeContentWithPanel: false, // Automatically close any open content when the panel closes
  },
  embeddedPlayerUrl:
    "https://wxsd-sales.github.io/vimeo-control-macro/webapp/index.html",
  contentServer:
    "https://wxsd-sales.github.io/vimeo-control-macro/webapp/content.json",
  username: "vimeoplayer", // Name of the local integration account which used for the websocket connect
  panelId: "vimeoplayer", // Modify if you have multiple copies of this marcro on a single device
};

/*********************************************************
 * Main functions and event subscriptions
 **********************************************************/

let openingWebview = false;
let integrationViews = [];
let content = [];


// Don't start macro on Devices without WebEngine Support
xapi.Config.WebEngine.Mode.get()
  .then((mode) => init(mode))
  .catch((error) =>
    console.warn("WebEngine not available:", JSON.stringify(error))
  );

async function init(webengineMode) {
  const username = config.username;

  if (webengineMode === "Off") {
    console.log("WebEngine Currently [Off] setting to [On]");
    xapi.Config.WebEngine.Mode.set("On");
  }

  xapi.Config.WebEngine.Features.AllowDeviceCertificate.set("True");

  xapi.Config.HttpClient.Mode.set("On");

  const integrationAccount = await xapi.Command.UserManagement.User.Get({
    Username: username,
  }).catch((error) => console.log("Error finding user:", error.message));

  if (integrationAccount) {
    // Delete account if its already exists (clear any previous config)
    deleteAccount();
  }

  createPanel('content');
  xapi.Event.UserInterface.Extensions.Widget.Action.on(processWidget);
  xapi.Event.UserInterface.Extensions.Event.PageClosed.on((event) => {
    console.log('page close:', event)
    if (!event.PageId.startsWith(config.panelId)) return;
    if (openingWebview) return;

    xapi.Status.SystemUnit.State.NumberOfActiveCalls.get().then((value) => {
      if (value == 1) return;
      console.log("Panel Closed - cleaning up");
      closeWebview();
      createPanel('content');
      deleteAccount();
    });
  });

  xapi.Event.UserInterface.Extensions.Event.PageOpened.on((event) => {
    if (!event.PageId.startsWith(config.panelId)) return;
    console.log("Panel Opened");
    createPanel('content');
  });

  xapi.Status.UserInterface.WebView.on(processWebViews);

}

function createAccount(password) {
  console.log(
    `Creating new user [${config.username}] with password [${password}]`
  );
  return xapi.Command.UserManagement.User.Add({
    Active: "True",
    Passphrase: password,
    PassphraseChangeRequired: "False",
    Role: ["Integrator", "User"],
    ShellLogin: "True",
    Username: config.username,
  })
    .then((result) => console.log("Create user result:", result.status))
    .catch((error) =>
      console.warn("Error creating user:", JSON.stringify(error))
    );
}

function deleteAccount() {
  console.log(`Deleting user [${config.username}]`);
  return xapi.Command.UserManagement.User.Delete({ Username: config.username })
    .then((result) => {
      console.log(`[${config.username}] delete status:`, result.status);
    })
    .catch((error) => {
      console.log("Error caught");
      if (!error.message.endsWith("does not exist")) {
        console.warning(
          `Error deleting user [${config.username}]:`,
          JSON.stringify(error)
        );
      } else {
        console.log(error.message);
      }
    });
}

// Generate a random password for
function createPassword(length) {
  if (length < 1 || length > 255) length = 255;
  const chars =
    "0123456789abcdefghijklmnopqrstuvwxyz!@#$%^&*()ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let password = "";
  for (let i = 0; i < length; i++) {
    let randomNumber = Math.floor(Math.random() * chars.length);
    password += chars.substring(randomNumber, randomNumber + 1);
  }
  return password;
}

async function generateHash(link) {
  const ipAddress = await xapi.Status.Network[1].IPv4.Address.get();
  const password = createPassword(255);
  await createAccount(password);
  return btoa(
    JSON.stringify({
      username: config.username,
      password: password,
      ipAddress: ipAddress,
      panelId: config.panelId,
      link,
    })
  );
}

async function openWebview(content) {
  closeWebview();
  console.log(`Opening [${content.title}] on [OSD]`);
  openingWebview = true;
  const hash = await generateHash(content.url);
  xapi.Command.UserInterface.WebView.Display({
    Mode: content.mode,
    Title: content.title,
    Target: "OSD",
    Url: config.embeddedPlayerUrl + "#" + hash,
  })
    .then((result) => {
      console.log("Webview opened on [OSD] ", JSON.stringify(result));
    })
    .catch((e) => console.log("Error: " + e.message));

  // Use this timeout to handle situations where the user opened
  // the content from a Board or Desk device and caused a panel close event
  setTimeout(() => {
    openingWebview = false;
  }, 500);
}

// Close the Webview
async function closeWebview() {
  xapi.Command.UserInterface.WebView.Clear({ Target: "OSD" });
  deleteAccount()
}

// Process Widget Clicks
async function processWidget(e) {
  if (!e.WidgetId.startsWith(config.panelId)) return;
  const [panelId, command, option] = e.WidgetId.split("-");
  switch (command) {
    case "selection":
      if (e.Type != "clicked") return;
      openWebview(content[option]);
      createPanel('playercontrols');
      break;
    case "close":
      closeWebview();
      createPanel('content');
      break;
  }
}

async function processWebViews(event) {
  console.log("WebView Status Change: ", JSON.stringify(event));
  if (event.hasOwnProperty("Status") && event.hasOwnProperty("Type")) {
    if (event.Status !== "Visible" || event.Type !== "Integration") return;
    if (!openWebview) return;
    console.log(`Recording Integration WebView id [${event.id}]`);
    integrationViews.push(event);
  } else if (event.hasOwnProperty("Status")) {
    if (event.Status === "NotVisible" || event.Status === "Error") {
      const result = integrationViews.findIndex(
        (webview) => webview.id === event.id
      );
      if (result === -1) return;

      xapi.Status.SystemUnit.State.NumberOfActiveCalls.get().then((value) => {
        if (value == 1) return;
        console.log(
          `Integration WebView id [${event.id}] changed to [${event.Status}] - closing all Integration WebViews`
        );
        closeWebview();
        integrationViews = [];
        deleteAccount();
      });
    }
  } else if (event.hasOwnProperty("ghost")) {
    const result = integrationViews.findIndex(
      (webview) => webview.id === event.id
    );
    if (result === -1) return;
    console.log(
      `Integration WebView id [${event.id}] ghosted - closing all Integration WebViews`
    );
    closeWebview();
    integrationViews = [];
  }
}

async function panelClicked(event) {
  if (event.PanelId !== config.panelId) return;
  createPanel(
    config.button,
    await getContent(config.contentServer),
    config.panelId
  );
}

function getContent(server) {
  console.log("Checking server URL: " + server);
  return xapi.Command.HttpClient.Get({ Url: server })
    .then((r) => {
      if (r.StatusCode != "200") return;
      return JSON.parse(r.Body);
    })
    .catch((e) => {
      console.log("Error getting content: " + e.message);
      return content.length == 0 ? [] : content;
    });
}

async function createPanel(state) {

  console.log('creating panel')
  const button = config.button;
  const panelId = config.panelId;

  const mtr = await xapi.Command.MicrosoftTeams.List({ Show: 'Installed' })
    .catch(err => false)


  let pageName = config.button.title;

  console.log(`Creating Panel [${panelId}]`);
  let rows = "";

  function widget(id, type, name, options) {
    return `<Widget><WidgetId>${panelId}-${id}</WidgetId>
            <Name>${name}</Name><Type>${type}</Type>
            <Options>${options}</Options></Widget>`;
  }

  function row(widgets = "") {
    return Array.isArray(widgets)
      ? `<Row>${widgets.join("")}</Row>`
      : `<Row>${widgets}</Row>`;
  }


  switch (state) {
    case "playercontrols":
      pageName = "Player Controls";
      rows = rows.concat(
        row(widget("close", "Button", "Close Content", "size=2"))
      );
      rows = rows.concat(
        row(
          widget(
            "title",
            "Text",
            "Playback Controls",
            "size=4;fontSize=normal;align=center"
          )
        )
      );
      rows = rows.concat(
        row(
          widget(
            "playTime",
            "Text",
            "Loading...",
            "size=2;fontSize=normal;align=center"
          )
        )
      );
      rows = rows.concat(
        row(widget("playercontrols-playTime", "Slider", "", "size=4"))
      );
      rows = rows.concat(
        row([
          widget(
            "playercontrols-playpause",
            "Button",
            "",
            "size=1;icon=play_pause"
          ),
          widget("playercontrols-stop", "Button", "", "size=1;icon=stop"),
          widget(
            "playercontrols-fastback",
            "Button",
            "",
            "size=1;icon=fast_bw"
          ),
          widget(
            "playercontrols-fastforward",
            "Button",
            "",
            "size=1;icon=fast_fw"
          ),
        ])
      );
      rows = rows.concat(
        row([
          widget(
            "playercontrols-toggleMute",
            "Button",
            "",
            "size=1;icon=volume_muted"
          ),
          widget("playercontrols-systemvolume", "Slider", "", "size=3"),
        ])
      );
      break;
    case "content":

      content = await getContent(config.contentServer)
      if (content == undefined || content.length < 0) {
        console.log(`No content available to show for [${panelId}]`);
        rows = row(
          widget(
            "no-content",
            "Text",
            "No Content Available",
            "size=4;fontSize=normal;align=center"
          )
        );
      } else {
        for (let i = 0; i < content.length; i++) {
          rows = rows.concat(
            row(
              widget(`selection-${i}`, "Button", content[i].title, "size=4")
            )
          );
        }
      }
  }

  let location = '';
  if(mtr){
    location = `<Location>ControlPanel</Location>`
  }else {
    location = `<Location>${button.showInCall ? "HomeScreenAndCallControls" : "HomeScreen"}</Location>
                <Type>${button.showInCall ? "Statusbar" : "Home"}</Type>`
  }

  let order = "";
  const orderNum = await panelOrder(config.panelId);
  if (orderNum != -1) order = `<Order>${orderNum}</Order>`;

  const panel = `
    <Extensions><Panel>
      ${location}
      <Type>${button.showInCall ? "Statusbar" : "Home"}</Type>
      <Icon>${button.icon}</Icon>
      <Color>${button.color}</Color>
      <Name>${button.name}</Name>
      ${order}
      <ActivityType>Custom</ActivityType>
      <Page>
        <Name>${pageName}</Name>
        ${rows}
        <PageId>${panelId}-page</PageId>
        <Options>hideRowNames=1</Options>
      </Page>
    </Panel></Extensions>`;

  return xapi.Command.UserInterface.Extensions.Panel.Save(
    { PanelId: panelId },
    panel
  );
}

async function panelOrder(panelId) {
  const list = await xapi.Command.UserInterface.Extensions.List({
    ActivityType: "Custom",
  });
  if (!list.hasOwnProperty("Extensions")) return -1;
  if (!list.Extensions.hasOwnProperty("Panel")) return -1;
  if (list.Extensions.Panel.length == 0) return -1;
  for (let i = 0; i < list.Extensions.Panel.length; i++) {
    if (list.Extensions.Panel[i].PanelId == panelId)
      return list.Extensions.Panel[i].Order;
  }
  return -1;
}
