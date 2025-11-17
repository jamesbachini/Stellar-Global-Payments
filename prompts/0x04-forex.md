I want to expand this demo to also include forex transactions.

I want 3 tabs at the top of the page. Payments, Forex, Multisig

Leave the Multisig as a blank placeholder for now we will build that out later.

The Forex page should open up the same map as the current UI (payments) only it will have two places.

New York - holding USDC
London - holding EURC

We want to be able to send payments back and forth similar to payments but the user needs to confirm the exchange rate first.

When the payment goes through we show the same fireworks confirmation and stellar.expert block explorer link as the payments Selection.

The backend then needs to do a swap between USDC and EURC using soroswap.

The contract address for EURC is CDTKPWPLOURQA2SGTKTUQOWRCBZEORB4BWBOMJ3D3ZTQQSGE5F6JBQLV
The contract address for USDC is CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75
The contract address for the Soroswap router is CAG5LRYQ5JVEUI5TEID72EYOVX44TTUJT5BQR2J6J77FH65PCCFAJDDH

This is for Stellar Mainnet, we are not deploying to testnet.

We can use the Soroswap API to get quotes but the swap needs to be done via the smart account smart contracts. They should have a built in function to swap specific hard coded tokens. Because anyone can call these functions the tokens need to set in an approved list.

API key is: ...retracted...
API_BASE_URL: https://api.soroswap.finance

Authenticate with:

const headers = {
  'Authorization': 'Bearer sk_test_1234567890abcdef',
  'Content-Type': 'application/json'
}

Example code from Soroswap docs: https://docs.soroswap.finance/soroswap-api/quickstart

// Minimal swap implementation
class SoroswapClient {
    constructor(apiKey, network = 'testnet') {
        this.apiKey = apiKey;
        this.network = network;
        this.baseUrl = 'https://api.soroswap.finance';
    }

    async apiRequest(endpoint, data) {
        const response = await fetch(`${this.baseUrl}${endpoint}?network=${this.network}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(`API Error: ${error.message}`);
        }
        
        return response.json();
    }

    // 1. Get best price quote
    async getQuote(assetIn, assetOut, amount, tradeType = 'EXACT_IN') {
        return this.apiRequest('/quote', {
            assetIn,
            assetOut,
            amount,
            tradeType,
            protocols: ['soroswap', 'phoenix', 'aqua']
        });
    }

    // 2. Build transaction from quote
    async buildTransaction(quote, fromAddress, toAddress = fromAddress) {
        return this.apiRequest('/quote/build', {
            quote,
            from: fromAddress,
            to: toAddress
        });
    }

    // 3. Submit signed transaction
    async sendTransaction(signedXdr, launchtube = false) {
        return this.apiRequest('/send', {
            xdr: signedXdr,
            launchtube
        });
    }
}

// Usage Example
const client = new SoroswapClient('sk_your_api_key');

async function executeSwap() {
    try {
        // 1. Quote
        const quote = await client.getQuote(
            'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC', // XLM
            'CBBHRKEP5M3NUDRISGLJKGHDHX3DA2CN2AZBQY6WLVUJ7VNLGSKBDUCM', // USDC
            '10000000' // 1 XLM
        );
        
        // 2. Build
        const { xdr } = await client.buildTransaction(quote, userAddress);
        
        // 3. Sign (using your preferred wallet)
        const signedXdr = await signWithWallet(xdr);
        
        // 4. Send
        const result = await client.sendTransaction(signedXdr);
        
        console.log('Swap completed!', result.txHash);
    } catch (error) {
        console.error('Swap failed:', error);
    }
}


Additional code from soroswap docs at: https://docs.soroswap.finance/soroswap-api/beginner-guide

const quoteRequest = {
    assetIn: CONFIG.TOKENS.XLM,         // What we're selling
    assetOut: CONFIG.TOKENS.USDC,       // What we want to buy
    amount: CONFIG.TRADE.AMOUNT,        // How much we're selling
    tradeType: CONFIG.TRADE.TYPE,       // Exact input amount
    protocols: CONFIG.TRADE.PROTOCOLS   // Which exchanges to check
};

appState.currentQuote = await makeAPIRequest('/quote', quoteRequest);
const outputAmount = formatAmount(appState.currentQuote.amountOut, 7); // USDC has 7 decimals

updateStatus(`✅ Quote received: ${outputAmount} USDC for 1 XLM<br>🔄 Building transaction...`, 'info');

// PHASE 2: Build Transaction
const buildRequest = {
    quote: appState.currentQuote,       // Use the quote we just got
    from: appState.walletAddress,       // Who's sending
    to: appState.walletAddress          // Who's receiving (same person in a swap)
};

const buildResult = await makeAPIRequest('/quote/build', buildRequest);
appState.unsignedXdr = buildResult.xdr;

// Show the unsigned transaction for educational purposes
ELEMENTS.unsignedXdr.value = buildResult.xdr;
ELEMENTS.technicalDetails.classList.remove('hidden');

updateStatus(`✅ Transaction built successfully!<br>⏳ Ready for signing...`, 'info');
updateButtonStates();

If you need more information on the soroswap API you can find the full reference guide here: https://api.soroswap.finance/docs

Here is the swap function in the test suite for the soroswap router:

From: https://github.com/soroswap/core/blob/1e479954/contracts/router/src/test/swap_exact_tokens_for_tokens.rs

#[test]
fn swap_exact_tokens_for_tokens_not_initialized() {
    let test = SoroswapRouterTest::setup();
    test.env.budget().reset_unlimited();
    let path: Vec<Address> = Vec::new(&test.env);

    let result = test.contract.try_swap_exact_tokens_for_tokens(
        &0,            // amount_in
        &0,            // amount_out_min
        &path,         // path
        &test.user,    // to
        &0,            // deadline
    );

    assert_eq!(
        result,
        Err(Ok(CombinedRouterError::RouterNotInitialized))
    );
}

Interface:
/// Swaps an exact amount of input tokens for as many output tokens as possible
/// along the specified trading route. The route is determined by the `path` vector,
/// where the first element is the input token, the last is the output token,
/// and any intermediate elements represent pairs to trade through if a direct pair does not exist.
/// 
/// # Arguments
/// * `amount_in` - The exact amount of input tokens to be swapped.
/// * `amount_out_min` - The minimum required amount of output tokens to receive.
/// * `path` - A vector representing the trading route, where the first element is the input token
/// and the last is the output token. Intermediate elements represent pairs to trade through.
/// * `to` - The address where the output tokens will be sent to.
/// * `deadline` - The deadline for executing the operation.
/// 
/// # Returns
/// A vector containing the amounts of tokens received at each step of the trading route.
fn swap_exact_tokens_for_tokens(amount_in: i128, amount_out_min: i128, path: vec<address>, to: address, deadline: u64) -> result<vec<i128>,CombinedRouterError>