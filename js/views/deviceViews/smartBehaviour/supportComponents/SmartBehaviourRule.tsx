import { AicoreBehaviour } from "../supportCode/AicoreBehaviour";
import { AicoreTwilight } from "../supportCode/AicoreTwilight";
import { ActivityIndicator, Alert, Text, TextStyle, TouchableOpacity, View } from "react-native";
import { colors, screenWidth } from "../../../styles";
import { SlideSideFadeInView } from "../../../components/animated/SlideFadeInView";
import { core } from "../../../../core";
import { Icon } from "../../../components/Icon";
import { NavigationUtil } from "../../../../util/NavigationUtil";
import * as React from "react";

export function SmartBehaviourRule(props) {
  let ai;
  if      (props.rule.type === "BEHAVIOUR") { ai = new AicoreBehaviour(props.rule.data); }
  else if (props.rule.type === "TWILIGHT")  { ai = new AicoreTwilight(props.rule.data);  }

  let labelStyle : TextStyle = {
    color: props.rule.syncedToCrownstone === false || props.faded ? colors.csBlue.rgba(0.4) : colors.csBlueDark.hex,
    fontSize:16,
    textAlign:'center',
    textDecorationLine: props.rule.deleted ? 'line-through' : 'none'
  };
  if (props.selected) {;
    labelStyle['color'] = colors.csBlueDark.hex;
    labelStyle['fontWeight'] = 'bold';
  }

  return (
    <View style={{padding:15, flexDirection: 'row', width: screenWidth, alignItems:'center', justifyContent:'center'}}>
      { /* Delete Icon */ }
      <SlideSideFadeInView width={50} visible={props.editMode && props.ruleSelection && !props.selected}></SlideSideFadeInView>
      <SlideSideFadeInView width={50} visible={props.editMode && !props.ruleSelection}>
        <TouchableOpacity onPress={() => {
          if (props.rule.syncedToCrownstone === false) {
            Alert.alert(
              "Are you sure?",
              "I'll remove this rule before it has been set on the Crownstone.",
              [{text:"OK", onPress:() => {
                  core.store.dispatch({
                    type: "REMOVE_STONE_RULE",
                    sphereId: props.sphereId,
                    stoneId: props.stoneId,
                    ruleId: props.ruleId,
                  });
                }}, {text:"Nope"}])
          }
          else {
            Alert.alert(
              "Are you sure?",
              "I'll delete this rule from the Crownstone as soon as I can. Once that is done it will be removed from the list, until then, it will be crossed through.",
              [{text:"OK", onPress:() => {
                  core.store.dispatch({
                    type: "MARK_STONE_RULE_FOR_DELETION",
                    sphereId: props.sphereId,
                    stoneId: props.stoneId,
                    ruleId: props.ruleId,
                  });
                }}, {text:"Nope"}])
          }
        }} style={{width:50}}>
          <Icon name={'ios-trash'} color={colors.red.rgba(0.6)} size={30} />
        </TouchableOpacity>
      </SlideSideFadeInView>
      { /* /Delete Icon */ }

      { /* ActivityIndicator for sync required */ }
      <SlideSideFadeInView width={50} visible={props.rule.syncedToCrownstone === false && !props.editMode}>
        <ActivityIndicator size={"small"} color={colors.csBlue.hex} style={{marginRight:15}} />
      </SlideSideFadeInView>
      { /* /ActivityIndicator for sync required */ }

      { /* Rule text */ }
      <View style={{flex:1}}>
        <Text style={labelStyle}>{ai.getSentence()}</Text>
        { props.rule.syncedToCrownstone === false && props.editMode && !props.ruleSelection ?
          <Text style={{color: colors.csBlueDark.hex,fontSize:13,textAlign:'center',}}>{"( Not on Crownstone yet... )"}</Text> : undefined }
      </View>
      { /* /Rule text */ }


      { /* Edit icon */ }
      <SlideSideFadeInView width={50} visible={props.editMode && !props.ruleSelection}>
        <TouchableOpacity onPress={() => {
          NavigationUtil.navigate(
            "DeviceSmartBehaviour_Editor",
            {
              data: ai,
              sphereId: props.sphereId,
              stoneId: props.stoneId,
              ruleId: props.ruleId
            });
        }} style={{width:50, alignItems:'flex-end'}}>
          <Icon name={'md-create'} color={colors.menuTextSelected.hex} size={26} />
        </TouchableOpacity>
      </SlideSideFadeInView>
      { /* /Edit icon */ }


      { /* Selection checkmark */ }
      <SlideSideFadeInView width={50} visible={props.editMode && props.ruleSelection && !props.selected}></SlideSideFadeInView>
      <SlideSideFadeInView width={50} visible={props.editMode && props.ruleSelection && props.selected}>
        <View style={{width:50, alignItems:'flex-end'}}>
          <Icon name={'ios-checkmark-circle'} color={colors.green.hex} size={26} />
        </View>
      </SlideSideFadeInView>
      { /* /Selection checkmark */ }

      { /* ActivityIndicator for sync required counterWeight */ }
      <SlideSideFadeInView width={50} visible={props.rule.syncedToCrownstone === false && !props.editMode} />
      { /* /ActivityIndicator for sync required */ }
    </View>
  );
}