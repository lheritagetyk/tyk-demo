import React from 'react'
import './TellerView.css'

function TellerView({
  customers,
  selectedCustomer,
  onSelectCustomer,
  accounts,
  selectedAccount,
  onSelectAccount,
  transactions,
  isAuthenticated
}) {
  // Debug logging
  React.useEffect(() => {
    console.log('🔍 TellerView received accounts prop:', accounts)
    console.log('🔍 Accounts length:', accounts?.length || 0)
    console.log('🔍 Selected customer:', selectedCustomer?.customerId)
    if (accounts && accounts.length > 0) {
      console.log('🔍 First account fields:', Object.keys(accounts[0]))
      console.log('🔍 First account nickname:', accounts[0].nickname)
      console.log('🔍 First account status:', accounts[0].status)
      console.log('🔍 First account name:', accounts[0].name)
      console.log('🔍 First account accountName:', accounts[0].accountName)
      accounts.forEach((acc, idx) => {
        console.log(`🔍 Account ${idx} (${acc.accountId}):`, {
          nickname: acc.nickname,
          status: acc.status,
          name: acc.name,
          accountName: acc.accountName
        })
      })
    }
  }, [accounts, selectedCustomer])

  return (
    <div className="teller-view">
      <div className="teller-header">
        <h2>Teller View</h2>
        {!isAuthenticated && (
          <div className="auth-prompt">
            Please complete OAuth flow to view customer data
          </div>
        )}
      </div>

      <div className="teller-content">
        <div className="customers-panel">
          <h3>Customers</h3>
          {!isAuthenticated ? (
            <div className="empty-state">Authenticate to load customers</div>
          ) : customers.length === 0 ? (
            <div className="empty-state">No customers found</div>
          ) : (
            <div className="customers-list">
              {customers.map((customer) => (
                <div
                  key={customer.customerId || customer.id}
                  className={`customer-item ${selectedCustomer?.customerId === customer.customerId ? 'selected' : ''}`}
                  onClick={() => onSelectCustomer(customer)}
                >
                  <div className="customer-name">
                    {customer.name?.first || customer.firstName || 'Unknown'} {' '}
                    {customer.name?.last || customer.lastName || ''}
                  </div>
                  <div className="customer-id">
                    ID: {customer.customerId || customer.id}
                  </div>
                  {customer.email && (
                    <div className="customer-email">{customer.email}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="accounts-panel">
          <h3>Accounts</h3>
          {!selectedCustomer ? (
            <div className="empty-state">Select a customer to view accounts</div>
          ) : accounts.length === 0 ? (
            <div className="empty-state">No accounts found for this customer</div>
          ) : (
            <div className="accounts-list">
              {accounts.map((account) => (
                <div
                  key={account.accountId || account.id}
                  className={`account-item ${selectedAccount?.accountId === account.accountId ? 'selected' : ''}`}
                  onClick={() => onSelectAccount(account)}
                >
                  <div className="account-header">
                    <div className="account-name">{account.nickname || account.name || account.accountName || 'Unnamed Account'}</div>
                    <div className="account-type">{account.accountType || account.type || 'Unknown'}</div>
                  </div>
                  {account.productName && (
                    <div className="account-product">{account.productName}</div>
                  )}
                  {(account.currentBalance !== undefined || account.availableBalance !== undefined || account.balance !== undefined) && (
                    <div className="account-balance">
                      {account.currencyCode || account.currency?.currencyCode || 'USD' === 'USD' ? '$' : ''}
                      {parseFloat(
                        account.currentBalance || 
                        account.availableBalance || 
                        account.balance?.amount || 
                        account.balance || 
                        0
                      ).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </div>
                  )}
                  <div className="account-id">ID: {account.accountId || account.id}</div>
                  {account.accountNumberDisplay && (
                    <div className="account-number">Account #: {account.accountNumberDisplay}</div>
                  )}
                  {account.accountNumber && !account.accountNumberDisplay && (
                    <div className="account-number">Account #: {account.accountNumber}</div>
                  )}
                  {account.status && (
                    <div className={`account-status ${account.status.toLowerCase()}`}>
                      Status: {account.status}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="transactions-panel">
          <h3>Transactions</h3>
          {!selectedAccount ? (
            <div className="empty-state">Select an account to view transactions</div>
          ) : transactions.length === 0 ? (
            <div className="empty-state">No transactions found for this account</div>
          ) : (
            <div className="transactions-list">
              <table className="transactions-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Transaction ID</th>
                    <th>Amount</th>
                    <th>Type</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction, index) => {
                    // Determine amount value - handle Amount object structure
                    const amountValue = transaction.amountValue || 
                                      (transaction.amount?.Amount || transaction.amount?.amount || transaction.amount)
                    const currency = transaction.currency || 
                                    (transaction.amount?.Currency || transaction.amount?.currency) || 
                                    'USD'
                    const isDebit = (transaction.type || transaction.transactionType || '').toUpperCase() === 'DEBIT'
                    
                    return (
                      <tr key={transaction.transactionId || transaction.id || index}>
                        <td>
                          {transaction.bookingDateTime 
                            ? new Date(transaction.bookingDateTime).toLocaleDateString()
                            : transaction.postedTimestamp 
                            ? new Date(transaction.postedTimestamp).toLocaleDateString()
                            : transaction.date || 'N/A'}
                        </td>
                        <td>
                          {transaction.transactionId || transaction.id || 'N/A'}
                        </td>
                        <td className={`amount ${isDebit ? 'debit' : 'credit'}`}>
                          {amountValue 
                            ? `${currency === 'USD' ? '$' : currency}${parseFloat(amountValue).toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              })}`
                            : 'N/A'}
                        </td>
                        <td>{transaction.type || transaction.transactionType || transaction.bankTransactionCodeCode || 'N/A'}</td>
                        <td>
                          <span className={`status ${transaction.status?.toLowerCase() || 'unknown'}`}>
                            {transaction.status || 'UNKNOWN'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TellerView

