I want to deploy the contracts to Stellar testnet before we deploy them to mainnet. 

Step 1. Can you update deploy_testnet.sh so it includes all the logic that deploy.sh has.
Step 2. Update the frontend so there is a switch in the code, not on the ui, to switch between testnet and mainnet. This might need to use a different shared config file or something like that. Basically in the config or somewhere else have a single one line:

activeNetwork = 'testnet' // change to 'mainnet'

Something like that, doesn't have to be that exactly but I want a single place where I can switch between the two. Testnet should be left as the current network.

Step 3. Check everything else in the code will run on Stellar testnet.

---
You'll need to use these testnet contract addresses:

USDC_CONTRACT_ID="CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA"
EURC_CONTRACT_ID="CCUUDM434BMZMYWYDITHFXHDMIVTGGD6T2I5UKNX5BSLXLW7HVR4MCGZ"
SOROSWAP_CONTRACT_ID="CCMAPXWVZD4USEKDWRYS7DA4Y3D7E2SDMGBFJUCEXTC7VN6CUBGWPFUS"