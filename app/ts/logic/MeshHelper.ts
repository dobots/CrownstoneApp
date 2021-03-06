import { BluenetPromiseWrapper } from '../native/libInterface/BluenetPromise';
import {LOG, LOGe, LOGi, LOGw} from '../logging/Log'
import { core } from "../core";


const MESH_PROPAGATION_TIMEOUT_MS = 8000;


export class MeshHelper {
  sphereId : any;
  meshNetworkId : any;
  meshInstruction : meshTodo;
  connectedStoneId : string;
  targets : any;
  _containedInstructions : any[] = [];
  activeOptions : batchCommandEntryOptions = {};

  constructor(sphereId, meshNetworkId, meshInstruction : meshTodo, connectedStoneId: string) {
    this.sphereId = sphereId;
    this.meshNetworkId = meshNetworkId;
    this.meshInstruction = meshInstruction;
    this.connectedStoneId = connectedStoneId;
  }

  performAction(connectionInfo: connectionInfo, onlyUsedAsMeshRelay : boolean = false) {
    let actionPromise = null;

    if (actionPromise === null) { actionPromise = this._handleMultiSwitchCommands(connectionInfo, onlyUsedAsMeshRelay); }

    if (actionPromise === null) {
      return actionPromise;
    }

    // This will return a BluenetPromiseWrapper promise
    return actionPromise
      .then((result) => {
        this._containedInstructions.forEach((instruction) => {
          if (instruction.stoneId === this.connectedStoneId || onlyUsedAsMeshRelay) {
            instruction.promise.resolve({data:result, viaMesh: onlyUsedAsMeshRelay});
            instruction.cleanup();
          }
        })
      })
  }

  /**
   * This method ensures that we only send a mesh command via this Crownstone if we also have to connect to this Crownstone directly.
   * @param commandArray
   * @private
   */
  _verifyDirectTarget(commandArray) {
    for (let i = 0; i < commandArray.length; i++) {
      let command = commandArray[i];
      if (command.stoneId === this.connectedStoneId) {
        return true;
      }
    }
    LOGi.mesh("MeshHelper: No direct target in set, moving on.");
    return false;
  }


  _handleMultiSwitchCommands(connectionInfo: connectionInfo, onlyUsedAsMeshRelay = false) {
    if (this.meshInstruction.multiSwitch.length > 0) {
      let multiSwitchInstructions : multiSwitchPayload[] = this.meshInstruction.multiSwitch;
      // get data from set
      let multiSwitchPackets = [];

      if (!onlyUsedAsMeshRelay) {
        if (this._verifyDirectTarget(multiSwitchInstructions) === false) {
          return null;
        }
      }

      for (let i = 0; i < multiSwitchInstructions.length; i++) {
        let instruction = multiSwitchInstructions[i];
        if (instruction.crownstoneId !== undefined && instruction.state !== undefined) {
          multiSwitchPackets.push({crownstoneId: instruction.crownstoneId, state: instruction.state});
          instruction.promise.pending = true;
          MeshHelper._mergeOptions(instruction.options, this.activeOptions);
          this._containedInstructions.push(instruction);
        }
        else {
          LOGe.mesh("MeshHelper: Invalid multiSwitchPackets instruction, required crownstoneId, state. Got:", instruction);
        }
      }
      if (multiSwitchPackets.length === 0) {
        return null;
      }

      // update the used channels.
      LOG.mesh('MeshHelper: Dispatching ', 'multiSwitchPackets ', multiSwitchPackets);
      return BluenetPromiseWrapper.multiSwitch(connectionInfo.handle, multiSwitchPackets)
    }
    return null;
  }


  static _mergeOptions(newOptions, existingOptions) {
    existingOptions.keepConnectionOpen = newOptions.keepConnectionOpen || existingOptions.keepConnectionOpen;
    if (existingOptions.keepConnectionOpenTimeout === undefined) {
      existingOptions.keepConnectionOpenTimeout = newOptions.keepConnectionOpenTimeout
    }
    else if (newOptions.keepConnectionOpenTimeout !== undefined && existingOptions.keepConnectionOpenTimeout !== undefined) {
      existingOptions.keepConnectionOpenTimeout = Math.max(newOptions.keepConnectionOpenTimeout, existingOptions.keepConnectionOpenTimeout);
    }
  }
}
