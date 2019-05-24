
import { Languages } from "../../Languages"

function lang(key,a?,b?,c?,d?,e?) {
  return Languages.get("SettingsFactoryResetStep1", key)(a,b,c,d,e);
}
import * as React from 'react'; import { Component } from 'react';
import {
  Image,
  Text,
  View
} from 'react-native';


import { Background } from '../components/Background'
import { setupStyle, NextButton } from './SetupShared'
import {colors, screenHeight, } from './../styles'
import { NavigationUtil } from "../../util/NavigationUtil";
import { core } from "../../core";
import { TopbarBackButton } from "../components/topbar/TopbarButton";

export class SettingsFactoryResetStep1 extends Component<any, any> {
  static navigationOptions = ({ navigation }) => {
    return {
      title: lang("Factory_Reset"),
      headerLeft: <TopbarBackButton text={lang("Back")} onPress={() => { navigation.goBack(null) }} />
    }
  };

  render() {
    let imageSize = 0.40;
    return (
      <Background hasNavBar={false} image={core.background.detailsDark}>
                <View style={{flex:1, flexDirection:'column', paddingTop:30}}>
          <Text style={[setupStyle.text, {color:colors.white.hex}]}>{ lang("If_youre_physically_next_") }</Text>
          <View style={setupStyle.lineDistance} />
          <Text style={[setupStyle.information, {color:colors.white.hex}]}>{ lang("Please_take_the_Crownston") }</Text>
          <View style={{flex:1}} />
          <View style={{flex:1, alignItems:'center', justifyContent:'center'}}>
            <Image source={require('../../images/lineDrawings/pluggingInPlugRetry.png')} style={{width:imageSize*screenHeight, height:imageSize*screenHeight}} />
          </View>
          <View style={{flex:1}} />
          <View style={setupStyle.buttonContainer}>
            <View style={{flex:1}} />
            <NextButton onPress={ () => {
              NavigationUtil.navigate( "SettingsFactoryResetStep2");
              // trigger to start the process
              setTimeout(() => { core.eventBus.emit("StartFactoryResetProcess"); }, 1000)
            }} />
          </View>
        </View>
      </Background>
    )
  }
}

