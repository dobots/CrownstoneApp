import { DEBUG } from '../ExternalConfig'

export const LOG = function() {
  console.log.apply(this, arguments);
};


export const LOGError = function() {
  console.log("< ------------------- ERROR ------------------- >");
  console.log.apply(this, arguments);
  console.log("</ ------------------- ERROR ------------------- >");
};


export const LOGDebug = function() {
  console.log("< ------------------- DEBUG ------------------- >");
  console.log.apply(this, arguments);
  console.log("</ ------------------- DEBUG ------------------- >");
};