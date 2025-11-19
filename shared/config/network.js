/**
 * Network Configuration Switch
 *
 * This is the single point of configuration for switching between
 * testnet and mainnet deployments.
 *
 * To switch networks:
 * 1. Change ACTIVE_NETWORK to either 'testnet' or 'mainnet'
 * 2. Run the corresponding deployment script (./deploy_testnet.sh or ./deploy.sh)
 * 3. Restart the backend server
 *
 * The deployment scripts generate separate config files:
 * - deploy_testnet.sh → shared/config/accounts.testnet.json
 * - deploy.sh → shared/config/accounts.mainnet.json
 *
 * The backend will automatically load the correct config based on this setting.
 */
export const ACTIVE_NETWORK = 'testnet';
