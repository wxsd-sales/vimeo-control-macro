# Vimeo Control Macro

This is an example macro and companion Web App which demonstrates how to control an embedded Vimeo player on a RoomOS Device for paired Controller ( either Touch 10" or Room Navigator).


## Overview

This macro lets you configure a list of Vimeo links which are displayed on a devices OSD, Room Navigator and OSD.

In the case of Cisco Devices with a paired Navigator and OSD, the macro also lets you control the Viemo playback via a local WebSocket connection estabilished by the open Web App player.

## Setup

### Prerequisites & Dependencies: 

- Webex Device running RoomOS 10.8 or above
- Paired Touch 10" or Room Navigator in Controller mode
- Device Web Admin or Control Hub access to enable and upload the Macro
- (Optional) Web Server to host the example embedded player Web App for Domain restricted Vimeo links

### Installation Steps:

1. Download the ``vimeo-local-macro.js`` or ``vimeo-server-macro.js``file and upload it to your Webex Device.
2. Configure the Macro by changing the initial values, there are comments explaining each one.
3. Enable the Macro.

## Validation

Validated Hardware:

* Webex Room Kit Pro with Touch 10
* Webex Desk Pro with Room Navigator
* Board 55 with Touch 10

This macro should work on other Webex Devices but has not been validated at this time.

## Demo

*For more demos & PoCs like this, check out our [Webex Labs site](https://collabtoolbox.cisco.com/webex-labs).

## License

All contents are licensed under the MIT license. Please see [license](LICENSE) for details.


## Disclaimer

Everything included is for demo and Proof of Concept purposes only. Use of the site is solely at your own risk. This site may contain links to third party content, which we do not warrant, endorse, or assume liability for. These demos are for Cisco Webex usecases, but are not Official Cisco Webex Branded demos.


## Questions
Please contact the WXSD team at [wxsd@external.cisco.com](mailto:wxsd@external.cisco.com?subject=vimeo-control-macro) for questions. Or, if you're a Cisco internal employee, reach out to us on the Webex App via our bot (globalexpert@webex.bot). In the "Engagement Type" field, choose the "API/SDK Proof of Concept Integration Development" option to make sure you reach our team. 
