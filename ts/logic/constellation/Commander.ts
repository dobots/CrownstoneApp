import { BroadcastCommandManager } from "../bchComponents/BroadcastCommandManager";
import { BleCommandLoader } from "./BleCommandQueue";
import { SessionManager } from "./SessionManager";
import { xUtil } from "../../util/StandAloneUtil";
import { MapProvider } from "../../backgroundProcesses/MapProvider";
import { Collector } from "./Collector";
import { core } from "../../core";

/**
 * The CommandAPI basically wraps all commands that you can send to a Crownstone. It contains a Collector (see below)
 * to provide connections. This is the class that you'll interact with most of all. You can perform multiple
 * commands on the CommandAPI, which are all asynchronous. The command API can choose to send commands via broadcast
 * if possible using the BroadcastCommandManager.
 *
 * The id identifies this command API. It is used to notify open slots belonging to this command API that a new command is available.
 * The privateId is used to ensure that a slot that is requested for this commandAPI will only process commands coming from this api.
 * This is used for setup and other processed which require to have full command over the connection.
 *
 * If the privateId is missing, the connection can be used for state updates like localization, which do not really care which Crownstones
 * get the command.
 */
class CommandAPI_base {
  id : string | null;
  options : commandOptions;

  _connectionRequested : boolean = false;
  _targetConnectionState : { [handle: string] : ConnectionState } = {};

  constructor(commandOptions: commandOptions) {
    this.options = commandOptions;
    this.options.commanderId ??= xUtil.getUUID();
    this.id = this.options.commanderId;
  }

  reconnect() {

  }

  /**
   * If via mesh is enabled, we will trigger a mesh connection request additionally to the direct one.
   * @param command
   * @param viaMesh
   */
  _load(command, allowMeshRelays: boolean) {
    return new Promise<any>((resolve, reject) => {
      BleCommandLoader.generateAndLoad(this.options, command, allowMeshRelays,{resolve, reject});


      if (this._connectionRequested === false) {
        // let collector = new Collector();
        // collector.collect(this.options);

        this._connectionRequested = true;
      }
    })
  }
}

class CommandMeshAPI extends CommandAPI_base {

  // async setSunTimes(sunriseSecondsSinceMidnight: number, sunsetSecondsSinceMidnight: number)
  // async meshSetTime(time:  number)
  // async setTime(time?: number)
  // async registerTrackedDevice(
  //   trackingNumber:     number,
  //   locationUID:  () => number | number,
  //   profileId:          number,
  //   rssiOffset:         number,
  //   ignoreForPresence:  boolean,
  //   tapToToggleEnabled: boolean,
  //   deviceToken:        number,
  //   ttlMinutes:         number
  // )
  // async trackedDeviceHeartbeat(
  //   trackingNumber:    number,
  //   locationUID: () => number | number,
  //   deviceToken:       number,
  //   ttlMinutes:        number
  // )
}


/**
 * this commander is used for the direct commands.
 * You can also send meshcommands to the Crownstone directly, thats why it inherits the meshAPI
 */
class CommandAPI extends CommandMeshAPI {


  async toggle(stateForOn : number) {

    return this;
  }

  async multiSwitch(state : number) {
    // either broadcast or connect

    return this;
  }

  async turnOn() : Promise<void>  {
    // either broadcast or connect
    let command : commandInterface = {type:"turnOn"}
    // TODO: add broadcastng to the commanders
    // if (BroadcastCommandManager.canBroadcast(command)) {
    //   // load in broadcast manager and auto-execute after setImmediate
    // }
    // else {
      // load into the commandQueue
      return this._load({type:"turnOn"}, true);
    // }
  }

  // async getBootloaderVersion()
  // async getFirmwareVersion()
  // async getHardwareVersion()
  // async addBehaviour(behaviour: behaviourTransfer)
  // async updateBehaviour(behaviour: behaviourTransfer)
  // async removeBehaviour(index: number)
  // async getBehaviour(index: number)
  // async syncBehaviour(behaviours: behaviourTransfer[])
  // async commandFactoryReset()
  // async sendNoOp()
  // async sendMeshNoOp()
  // async getBootloaderVersion()
  // async getFirmwareVersion()
  // async getHardwareVersion()

  // async clearErrors(clearErrorJSON: any)
  // async lockSwitch(value: boolean)
  // async setSwitchCraft(value: boolean)
  // async allowDimming(value: boolean)
  // async setSoftOnSpeed(softOnSpeed: number)
  // async setTapToToggle(value: boolean)
  // async setTapToToggleThresholdOffset(rssiOffset: number)
  // async setMeshChannel(channel: number)
  // async setupPulse()
  // async getBehaviourDebugInformation()
  // async getCrownstoneUptime()
  // async getAdcRestarts()
  // async getMinSchedulerFreeSpace()
  // async getLastResetReason()
  // async getGPREGRET()
  // async getAdcChannelSwaps()
  // async getSwitchHistory()
  // async getPowerSamples(type: PowersampleDataType)


  async end() {

  }


  /**
   * MARK: these can be sent to multiple crownstones
   */




}





/**
I want to use the commandAPI for ALL interactions with bluetooth. This means the following:
- direct connection where only your commands are pushed to this Crownstone.
    - this is a private session
    - commands can trickle in, do not close the connection automatically. (wait for end())
    - on failed connection attempt, fail the active commandAPI instance.     maybe allow for reconnecting?
    - on read/write to the crownstone after disconnect, fail the commandAPI. maybe allow for reconnecting?
    - private connections MUST BE SINGULAR! (ie 1 connection target)
- connections where anyone throwing up commands can use the connection to deliver their message.
  - shared connections
  - get their own commands from the queueManager based on handle, mesh, sphere etc.
  - close the connection if nobody needs it any more.

 How do we handle commands which include a reset cycle? These would mark sessions as actively ended and removed.
 We could argue that we keep a session active, even though it died.
 The commandAPI and the session state must be linked.. Or should they? If you read/write while youre not connected it will just fail in the lib. Thats great!

 Conclusion:
 CommandAPI has no connection state.
 - In the case of a private connection




 */