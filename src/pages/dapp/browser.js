import React, { Component, createRef } from 'react';
import {
  Platform, View,
} from 'react-native';
import RNFS from 'react-native-fs';
import PropTypes from 'prop-types';
import { ethers } from 'ethers';
import Rsk3 from '@rsksmart/rsk3';
import { connect } from 'react-redux';
import appActions from '../../redux/app/actions';
import BrowerHeader from '../../components/headers/header.browser';
import ProgressWebView from '../../components/common/progress.webview';
import WalletSelection from '../../components/common/modal/wallet.selection.modal';

const rskEndpoint = 'https://public-node.testnet.rsk.co';
const rsk3 = new Rsk3(rskEndpoint);
const provider = new ethers.providers.JsonRpcProvider(rskEndpoint);

class DAppBrowser extends Component {
  static navigationOptions = () => ({
    header: null,
  });

  constructor(props) {
    super(props);

    const { navigation } = this.props;
    const currentWallet = navigation.state.params.wallet || null;

    this.state = {
      canGoBack: false,
      walletSelectionVisible: false,
      wallet: this.generateWallet(currentWallet),
      web3JsContent: '',
      ethersJsContent: '',
    };

    this.webview = createRef();
  }

  componentDidMount() {
    const { web3JsContent, ethersJsContent } = this.state;
    if (web3JsContent === '') {
      if (Platform.OS === 'ios') {
        RNFS.readFile(`${RNFS.MainBundlePath}/web3.js`, 'utf8')
          .then((content) => {
            this.setState({ web3JsContent: content });
          });
      } else {
        RNFS.readFileAssets('web3.js', 'utf8')
          .then((content) => {
            this.setState({ web3JsContent: content });
          });
      }
    }

    if (ethersJsContent === '') {
      if (Platform.OS === 'ios') {
        RNFS.readFile(`${RNFS.MainBundlePath}/ethers.js`, 'utf8')
          .then((content) => {
            this.setState({ ethersJsContent: content });
          });
      } else {
        RNFS.readFileAssets('ethers.js', 'utf8')
          .then((content) => {
            this.setState({ ethersJsContent: content });
          });
      }
    }
  }

  generateWallet = (currentWallet) => {
    // // generate mainnet wallet
    // return { ...currentWallet, address: currentWallet.coins[0].address };

    // generate test wallet
    const { mnemonic } = currentWallet;
    const mnemonicWallet = ethers.Wallet.fromMnemonic(mnemonic, "m/44'/37310'/0'/0/0");
    return mnemonicWallet;
  }

  getJsCode = (address) => {
    const { web3JsContent, ethersJsContent } = this.state;
    return `
      ${web3JsContent}
      ${ethersJsContent}

      (function() {
        let resolver, rejecter, hash
        setTimeout(() => {
          ${Platform.OS === 'ios' ? 'window' : 'document'}.addEventListener("message", function(data) {
            const result = data.data
            if (result && resolver) {
              resolver(result)
            } else if (rejecter) {
              rejecter(1)
            }
          })
        }, 0)

        getHash = (payload) => {
          return new Promise((resolve, reject) => {
            window.ReactNativeWebView.postMessage(JSON.stringify(payload))
            resolver = resolve
            rejecter = reject
          })
        }

        getTransactionReceipt = (payload) => {
          return new Promise((resolve, reject) => {
            window.ReactNativeWebView.postMessage(JSON.stringify(payload))
            resolver = resolve
            rejecter = reject
          })
        }

        function initWeb3() {
          const rskEndpoint = 'https://public-node.testnet.rsk.co';
          const web3 = new Web3(rskEndpoint);
          window.ethereum = web3;
          window.ethereum.selectedAddress = '${address}'
          window.ethereum.networkVersion = '31'
          window.web3 = web3
          const provider = new ethers.providers.JsonRpcProvider(rskEndpoint);
          const config = {
            isEnabled: true,
            isUnlocked: true,
            networkVersion: '31',
            onboardingcomplete: true,
            selectedAddress: '${address}',
          }
          window.ethereum.publicConfigStore = {
            _state: {
              ...config,
            },
            getState: () => {
              return {
                ...config,
              }
            }
          }

          window.ethereum.enable = () => {
            return new Promise((resolve, reject) => {
              resolve(['${address}'])
            })
          }

          window.ethereum.on = (method, callback) => { if (method) {console.log(method)} }

          const sendAsync = async (payload, callback) => {
            window.ethereum.sendAsync = window.ethereum.send
            let err, res, result = ''
            const {method, params, jsonrpc, id} = payload
            try {
              if (method === 'net_version') {
                result = '31'
              }
              if (method === 'eth_getBlockByNumber') {
                const blockNumber = await provider.getBlockNumber()
                result = await provider.getBlock(blockNumber)
              }
              if (method === 'eth_call') {
                result = await provider.call(params[0], params[1])
              }
              if (method === 'eth_requestAccounts') {
                result = ['${address}']
              }
              if (method === 'eth_estimateGas') {
                result = await provider.estimateGas(params[0])
                result = result.toNumber()
              }
              if (method === 'eth_sendTransaction') {
                result = await getHash(payload)
                hash = result
              }
              if (method === 'eth_getTransactionReceipt') {
                result = await getTransactionReceipt(payload)
                result = JSON.parse(result)
              }
              if (method === 'eth_getTransactionByHash') {
                result = await provider.getTransaction(params[0])
              }
              if (method === 'eth_gasPrice') {
                result = await provider.getGasPrice()
              }

              res = {id, jsonrpc, result}
            } catch(err) {
              err = err
              console.log('err: ', err)
            }
            callback(err, res)
          }

          window.web3.setProvider(window.ethereum)
          window.ethereum.send = sendAsync
          window.ethereum.sendAsync = sendAsync
        }

        setTimeout(() => {
          initWeb3()
        }, 0)
      }) ();
      true
    `;
  }

  render() {
    const { navigation, callAuthVerify, language } = this.props;
    const { walletSelectionVisible, wallet } = this.state;

    const dapp = navigation.state.params.dapp || { url: '', title: '' };
    const { url, title } = dapp;
    const { address } = wallet;
    console.log('address: ', address);

    const jsCode = this.getJsCode(address);

    return (
      <View style={{ flex: 1 }}>
        <BrowerHeader
          title={(title && title[language]) || url}
          onBackButtonPress={() => {
            const { canGoBack } = this.state;
            if (canGoBack) {
              this.webview.current.goBack();
            } else {
              navigation.goBack();
            }
          }}
          onCloseButtonPress={() => navigation.goBack()}
          onSwitchButtonPress={() => this.setState({ walletSelectionVisible: true })}
        />
        <ProgressWebView
          source={{ uri: url }}
          ref={this.webview}
          onLoadStart={() => {
            this.webview.current.injectJavaScript(jsCode);
          }}
          onNavigationStateChange={(navState) => {
            const { canGoBack } = navState;
            this.setState({ canGoBack });
          }}
          onMessage={(event) => {
            const { data } = event.nativeEvent;
            const payload = JSON.parse(data);
            const { method, params } = payload;
            console.log('payload: ', payload);
            if (method === 'eth_sendTransaction') {
              console.log('address: ', address);
              try {
                callAuthVerify(async () => {
                  const nonce = await provider.getTransactionCount(address);
                  const txData = {
                    nonce,
                    data: params[0].data,
                    gasLimit: params[0].gas || 600000,
                    gasPrice: params[0].gasPrice || ethers.utils.bigNumberify(('1200000000')),
                    to: params[0].to,
                    value: (params[0].value && ethers.utils.bigNumberify(params[0].value)) || '0x0',
                  };
                  const signedTransaction = await wallet.sign(txData);
                  const result = await provider.sendTransaction(signedTransaction);
                  this.webview.current.postMessage(result.hash);
                }, () => null);
              } catch (error) {
                console.log('error', error);
              }
            } else if (method === 'eth_getTransactionReceipt') {
              rsk3.getTransactionReceipt(params[0]).then((res) => {
                res.status = res.status ? 1 : 0;
                this.webview.current.postMessage(JSON.stringify(res));
              }).catch((err) => {
                console.log('err: ', err);
                this.webview.current.postMessage('');
              });
            }
          }}
        />
        <WalletSelection
          navigation={navigation}
          visible={walletSelectionVisible}
          closeFunction={() => this.setState({ walletSelectionVisible: false })}
          confirmButtonPress={(switchWallet) => {
            this.setState({ walletSelectionVisible: false, wallet: this.generateWallet(switchWallet) }, () => {
              this.webview.current.reload();
              setTimeout(() => {
                this.webview.current.injectJavaScript(jsCode);
              }, 500);
            });
          }}
          dapp={dapp}
        />
      </View>
    );
  }
}

DAppBrowser.propTypes = {
  navigation: PropTypes.shape({
    navigate: PropTypes.func.isRequired,
    dispatch: PropTypes.func.isRequired,
    goBack: PropTypes.func.isRequired,
    state: PropTypes.object.isRequired,
  }).isRequired,
  callAuthVerify: PropTypes.func.isRequired,
  language: PropTypes.string.isRequired,
};

const mapStateToProps = (state) => ({
  passcode: state.App.get('passcode'),
  language: state.App.get('language'),
});

const mapDispatchToProps = (dispatch) => ({
  callAuthVerify: (callback, fallback) => dispatch(
    appActions.callAuthVerify(callback, fallback),
  ),
});

export default connect(mapStateToProps, mapDispatchToProps)(DAppBrowser);
