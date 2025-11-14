Let's move everything from testnet to Stellar mainnet.

NETWORK_PASSPHRASE = 'Public Global Stellar Network ; September 2015';
HORIZON_URL = 'https://horizon.stellar.org';
SOROBAN_RPC_URL = 'https://rpc.lightsail.network/';

I'll deploy everything manually using deploy.sh, I've made a copy of this called deploy_testnet.sh in case we ever want to use that again. Update deploy.sh then update the frontend and backend files to match. I'll run deploy.sh and we should have a production site ready to go.