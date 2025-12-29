import React, { useState, useEffect } from 'react'
import './App.css'
import ApiCallPane from './components/ApiCallPane'
import TellerView from './components/TellerView'
import OAuthFlow from './components/OAuthFlow'
import { ApiCallLogger } from './services/apiLogger'
import { FDXApiService } from './services/fdxApiService'

function App() {
  const [apiCalls, setApiCalls] = useState([])
  const [accessToken, setAccessToken] = useState(null)
  const [customers, setCustomers] = useState([])
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [selectedAccount, setSelectedAccount] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [oauthState, setOauthState] = useState({
    step: 'init',
    requestUri: null,
    authCode: null,
    token: null,
    error: null
  })

  // Initialize API logger
  useEffect(() => {
    ApiCallLogger.onLog((call) => {
      setApiCalls(prev => [...prev, call])
    })
  }, [])

  // Load customers when explicitly requested (via Step 4 button)
  // Removed automatic loading - now triggered by OAuthFlow component

  // Debug: Log when accounts state changes
  useEffect(() => {
    console.log('🔍 Accounts state changed:', accounts.length, 'accounts')
    console.log('🔍 Accounts data:', accounts)
  }, [accounts])

  // Load accounts when customer is selected
  useEffect(() => {
    if (selectedCustomer && accessToken) {
      console.log('👤 Customer selected, loading accounts:', selectedCustomer.customerId || selectedCustomer.id)
      // Clear previous accounts and selected account when customer changes
      setAccounts([])
      setSelectedAccount(null)
      setTransactions([])
      loadAccounts()
    } else if (!selectedCustomer) {
      // Clear accounts when no customer is selected
      setAccounts([])
      setSelectedAccount(null)
      setTransactions([])
    }
  }, [selectedCustomer, accessToken])

  // Load transactions when account is selected
  useEffect(() => {
    if (selectedAccount && accessToken) {
      console.log('💳 Account selected, loading transactions:', selectedAccount.accountId || selectedAccount.id)
      // Clear previous transactions when account changes
      setTransactions([])
      loadTransactions()
    } else if (!selectedAccount) {
      // Clear transactions when no account is selected
      setTransactions([])
    }
  }, [selectedAccount, accessToken])

  const loadCustomers = async (token = null) => {
    const tokenToUse = token || accessToken
    if (!tokenToUse) {
      console.warn('⚠️ Cannot load customers: no access token available')
      return
    }
    try {
      console.log('📥 Loading customers with token:', tokenToUse.substring(0, 20) + '...')
      const customersData = await FDXApiService.getCustomers(tokenToUse)
      console.log('✅ Customers loaded:', customersData)
      setCustomers(customersData.customers || [])
    } catch (error) {
      console.error('❌ Error loading customers:', error)
      ApiCallLogger.log({
        method: 'GET',
        url: '/customers',
        status: 'error',
        error: error.message
      })
    }
  }

  const loadAccounts = async () => {
    if (!accessToken) {
      console.warn('⚠️ Cannot load accounts: no access token available')
      return
    }
    if (!selectedCustomer) {
      console.warn('⚠️ Cannot load accounts: no customer selected')
      return
    }
    
    try {
      const customerId = selectedCustomer.customerId || selectedCustomer.id
      console.log('📥 Step 1: Fetching customer details for:', customerId)
      
      // Step 1: Fetch full customer details from /customers/{customerId}
      const customerDetails = await FDXApiService.getCustomerById(accessToken, customerId)
      console.log('✅ Customer details fetched:', customerDetails)
      
      // Extract accounts array from customer details
      const customerAccounts = customerDetails.accounts || []
      console.log('📥 Step 2: Customer accounts array:', customerAccounts)
      
      if (customerAccounts.length === 0) {
        console.log('⚠️ Customer has no accounts')
        setAccounts([])
        return
      }
      
      // Step 3: Loop through each account and fetch full account details from /fdxfapi/accounts/{accountId}
      console.log('📥 Step 3: Fetching account details for each account from /fdxfapi/accounts/{accountId}...')
      const accountPromises = customerAccounts.map(customerAccount => {
        const accountId = customerAccount.accountId
        if (!accountId) {
          console.warn('⚠️ Customer account missing accountId:', customerAccount)
          return Promise.resolve(null)
        }
        
        console.log(`📥 Fetching account details for: ${accountId}`)
        console.log(`📥 Will call: /fdxfapi/accounts/${accountId}`)
        return FDXApiService.getAccount(accessToken, accountId)
          .then(response => {
            console.log(`✅ Raw response for account ${accountId}:`, JSON.stringify(response, null, 2))
            
            // Handle different response structures
            // Response might be: { account: {...} }, { Account: {...} }, { Data: { Account: {...} } }, or just the account object directly
            let accountData = response
            if (response.account) {
              accountData = response.account
              console.log(`📥 Extracted account from response.account`)
            } else if (response.Account) {
              accountData = response.Account
              console.log(`📥 Extracted account from response.Account`)
            } else if (response.Data?.Account) {
              accountData = response.Data.Account
              console.log(`📥 Extracted account from response.Data.Account`)
            } else {
              console.log(`📥 Using response directly as account data`)
            }
            
            console.log(`✅ Account details extracted for ${accountId}:`, {
              AccountId: accountData.AccountId,
              accountId: accountData.accountId,
              Nickname: accountData.Nickname,
              nickname: accountData.nickname,
              Status: accountData.Status,
              status: accountData.status,
              hasNickname: !!(accountData.Nickname || accountData.nickname),
              hasStatus: !!(accountData.Status || accountData.status),
              allKeys: Object.keys(accountData || {})
            })
            
            // Normalize the account data - convert AccountId/Nickname/Status to lowercase
            const normalizedAccount = {
              ...accountData, // Spread all original fields
              // Normalize ID field - use customer's accountId to preserve the original ID format
              accountId: accountId, // Use customer's accountId
              AccountId: accountData.AccountId || accountData.accountId, // Keep API's AccountId too
              // Normalize Nickname to nickname (API uses capital N)
              nickname: accountData.Nickname || accountData.nickname || null,
              Nickname: accountData.Nickname || accountData.nickname,
              // Normalize Status to status (API uses capital S)
              status: accountData.Status || accountData.status || null,
              Status: accountData.Status || accountData.status,
              // Preserve relationship and links from customer account
              relationship: customerAccount.relationship,
              links: customerAccount.links
            }
            
            console.log(`✅ Normalized account data:`, {
              accountId: normalizedAccount.accountId,
              nickname: normalizedAccount.nickname,
              status: normalizedAccount.status
            })
            
            return normalizedAccount
          })
          .catch(error => {
            console.error(`❌ Failed to load account details for ${accountId}:`, error)
            console.error(`❌ Error status:`, error.response?.status)
            console.error(`❌ Error data:`, error.response?.data)
            // Return basic account info from customer data if detail fetch fails
            return {
              accountId: accountId,
              relationship: customerAccount.relationship,
              links: customerAccount.links
            }
          })
      })
      
      const accountDetails = await Promise.all(accountPromises)
      
      const validAccounts = accountDetails.filter(acc => acc !== null && acc.accountId)
      
      console.log('📥 Step 4: Normalizing account data for display...')
      console.log('📥 Account details fetched (raw):', validAccounts)
      
      // Normalize account data for display
      // Account data is already normalized from the matching step above
      const accounts = validAccounts.map((account, index) => {
        console.log(`📥 Final normalization for account ${index} (raw):`, {
          accountId: account.accountId || account.AccountId,
          nickname: account.nickname || account.Nickname,
          status: account.status || account.Status,
          hasNickname: !!(account.nickname || account.Nickname),
          hasStatus: !!(account.status || account.Status),
          allKeys: Object.keys(account || {})
        })
        
        // Extract fields with fallbacks (handle both capital and lowercase)
        const nickname = account.nickname || account.Nickname || null
        const status = account.status || account.Status || null
        const accountId = account.accountId || account.AccountId || null
        const accountType = account.accountType || account.AccountType || account.type || null
        
        // Build normalized account - preserve all original fields and ensure nickname/status are set
        const normalizedAccount = {
          ...account, // Spread all original account data first
          // Explicitly set normalized fields (lowercase) to ensure they're present
          accountId: accountId,
          nickname: nickname,
          status: status,
          accountType: accountType,
          // Use ONLY nickname for name fields - don't use nested Account.Name or other fields
          name: nickname || null, // Only use nickname, not Account.Name or other fields
          accountName: nickname || null // Only use nickname, not Account.Name or other fields
        }
        
        console.log(`✅ Final normalized account ${index}:`, {
          accountId: normalizedAccount.accountId,
          nickname: normalizedAccount.nickname,
          status: normalizedAccount.status,
          name: normalizedAccount.name,
          hasNickname: !!normalizedAccount.nickname,
          hasStatus: !!normalizedAccount.status
        })
        
        return normalizedAccount
      })
      
      console.log('✅ Accounts loaded:', accounts.length, 'accounts')
      console.log('✅ Account IDs:', accounts.map(a => a.accountId))
      console.log('✅ Accounts with nickname and status:', accounts.map(a => ({
        accountId: a.accountId,
        nickname: a.nickname,
        status: a.status,
        hasNickname: !!a.nickname,
        hasStatus: !!a.status
      })))
      setAccounts(accounts)
    } catch (error) {
      console.error('❌ Error loading accounts:', error)
      ApiCallLogger.log({
        method: 'GET',
        url: '/accounts',
        status: 'error',
        error: error.message
      })
    }
  }

  const loadTransactions = async () => {
    if (!selectedAccount) {
      console.warn('⚠️ Cannot load transactions: no account selected')
      return
    }
    if (!accessToken) {
      console.warn('⚠️ Cannot load transactions: no access token available')
      return
    }
    try {
      console.log('📥 Loading transactions for account:', selectedAccount.accountId)
      const transactionsData = await FDXApiService.getAccountTransactions(
        accessToken,
        selectedAccount.accountId
      )
      console.log('📥 Transactions API response:', transactionsData)
      
      // API returns { transactions: [...] } or { Data: { Transaction: [...] } } structure
      // Handle both possible structures for compatibility
      const transactionsArray = transactionsData?.transactions || transactionsData?.Data?.Transaction || []
      
      const transactions = transactionsArray.map(transaction => ({
        transactionId: transaction.TransactionId || transaction.transactionId,
        accountId: transaction.AccountId || transaction.accountId,
        // Amount is an object with Amount and Currency properties
        amount: transaction.Amount || transaction.amount,
        amountValue: transaction.Amount?.Amount || transaction.Amount?.amount || transaction.amount?.Amount || transaction.amount?.amount || transaction.amount,
        currency: transaction.Amount?.Currency || transaction.Amount?.currency || transaction.currency,
        // TransactionInformation is the description
        description: transaction.TransactionInformation || transaction.transactionInformation || transaction.Description || transaction.description || transaction.Memo || transaction.memo,
        memo: transaction.TransactionInformation || transaction.transactionInformation || transaction.Description || transaction.description || transaction.Memo || transaction.memo,
        // CreditDebitIndicator indicates the type
        type: transaction.CreditDebitIndicator || transaction.creditDebitIndicator || transaction.Type || transaction.type || transaction.TransactionType || transaction.transactionType,
        transactionType: transaction.CreditDebitIndicator || transaction.creditDebitIndicator || transaction.Type || transaction.type || transaction.TransactionType || transaction.transactionType,
        status: transaction.Status || transaction.status,
        // BookingDateTime is the primary date field
        bookingDateTime: transaction.BookingDateTime || transaction.bookingDateTime,
        valueDateTime: transaction.ValueDateTime || transaction.valueDateTime,
        postedTimestamp: transaction.BookingDateTime || transaction.bookingDateTime || transaction.PostedTimestamp || transaction.postedTimestamp,
        date: transaction.BookingDateTime || transaction.bookingDateTime || transaction.ValueDateTime || transaction.valueDateTime || transaction.PostedTimestamp || transaction.postedTimestamp || transaction.Date || transaction.date,
        // Bank transaction code
        bankTransactionCode: transaction.BankTransactionCode || transaction.bankTransactionCode,
        bankTransactionCodeCode: transaction.BankTransactionCode?.Code || transaction.BankTransactionCode?.code || transaction.bankTransactionCode?.Code || transaction.bankTransactionCode?.code,
        bankTransactionCodeSubCode: transaction.BankTransactionCode?.SubCode || transaction.BankTransactionCode?.subCode || transaction.bankTransactionCode?.SubCode || transaction.bankTransactionCode?.subCode,
        // Merchant details
        merchantDetails: transaction.MerchantDetails || transaction.merchantDetails,
        merchantName: transaction.MerchantDetails?.MerchantName || transaction.MerchantDetails?.merchantName || transaction.merchantDetails?.MerchantName || transaction.merchantDetails?.merchantName,
        merchantCategoryCode: transaction.MerchantDetails?.MerchantCategoryCode || transaction.MerchantDetails?.merchantCategoryCode || transaction.merchantDetails?.MerchantCategoryCode || transaction.merchantDetails?.merchantCategoryCode,
        ...transaction // Include all other fields
      }))
      
      console.log('✅ Transactions loaded:', transactions.length, 'transactions')
      setTransactions(transactions)
    } catch (error) {
      console.error('❌ Error loading transactions:', error)
      ApiCallLogger.log({
        method: 'GET',
        url: `/accounts/${selectedAccount.accountId}/transactions`,
        status: 'error',
        error: error.message
      })
    }
  }

  const handleOAuthComplete = (token) => {
    console.log('🎉 OAuth complete callback received')
    console.log('🔑 Token received (first 20 chars):', token ? token.substring(0, 20) + '...' : 'null')
    
    if (!token) {
      console.warn('⚠️ OAuth complete but no token provided')
      return
    }
    
    // Set the token in state
    setAccessToken(token)
    setOauthState(prev => ({ ...prev, step: 'authenticated', token }))
    
    // Load customers immediately with the token (don't wait for state update)
    console.log('📥 Loading customers with new token...')
    loadCustomers(token)
  }

  const handleOAuthStateChange = (newState) => {
    setOauthState(newState)
  }


  return (
    <div className="app">
      <header className="app-header">
        <h1>FDX Open Banking Flow - PAR to DPoP</h1>
        <div className="oauth-status">
          Status: <span className={`status-${oauthState.step}`}>{oauthState.step}</span>
        </div>
      </header>

      <div className="app-content">
        <div className="left-pane">
          <OAuthFlow
            onComplete={handleOAuthComplete}
            onStateChange={handleOAuthStateChange}
            oauthState={oauthState}
            onLoadCustomers={loadCustomers}
          />
          <ApiCallPane apiCalls={apiCalls} />
        </div>

        <div className="center-pane">
          <TellerView
            customers={customers}
            selectedCustomer={selectedCustomer}
            onSelectCustomer={setSelectedCustomer}
            accounts={accounts}
            selectedAccount={selectedAccount}
            onSelectAccount={setSelectedAccount}
            transactions={transactions}
            isAuthenticated={oauthState.step === 'authenticated'}
          />
        </div>
      </div>
    </div>
  )
}

export default App

