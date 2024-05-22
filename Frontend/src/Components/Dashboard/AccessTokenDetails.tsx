import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../../firebase";
import { useAuth } from "../Header/AuthContext";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import "../Dashboard/token.css";


interface BalancesResponse {
  accounts: Account[];
  item: Item;
  request_id: string;
}

interface Account {
  account_id: string;
  balances: Balances;
  name: string;
  official_name: string;
  subtype: string;
  type: string;
}

interface Balances {
  available: number;
  current: number;
  iso_currency_code: string;
  limit: number | null;
}

interface Item {
  available_products: string[];
  billed_products: string[];
  consent_expiration_time: string | null;
  error: string | null;
  institution_id: string;
  item_id: string;
  products: string[];
  update_type: string;
  webhook: string;
}

interface TransactionsResponse {
  latest_transactions: Transaction[];
}

interface Transaction {
  account_id: string;
  account_owner: string | null;
  amount: number;
  category: string[];
  category_id: string;
  date: string;
  iso_currency_code: string;
  merchant_name: string | null;
  name: string;
  pending: boolean;
  transaction_id: string;
  transaction_type: string;
}

interface ExpenseResponse {
  expenses: Expense[];
  success: boolean
}

interface Expense {
  amount: number,
  category: string,
  duration: string,
  firebase_user_id: string,
  id: string
}

interface BudgetResponse {
  budgets: Budget[];
  success: boolean
}

interface Budget {
  amount: number,
  duration: string,
  firebase_user_id: string,
  id: string
}

const AccessTokenDetails = () => {
  const { tokenId } = useParams<{ tokenId: string }>();
  const [balancesData, setBalancesData] = useState<BalancesResponse | null>(null);
  const [transactionsData, setTransactionsData] = useState<TransactionsResponse | null>(null);
  const [expenseData, setExpenseData] = useState<ExpenseResponse | null>(null);
  const [budgetData, setBudgetData] = useState<BudgetResponse | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const transactionsPerPage = 4;
  const navigate = useNavigate();
  const { setIsUserLoggedIn } = useAuth();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showCreateExpenseModal, setShowCreateExpenseModal] = useState(false);
  const [showDeleteExpenseModal, setShowDeleteExpenseModal] = useState(false);
  const [showCreateBudgetModal, setShowCreateBudgetModal] = useState(false);
  const [showDeleteBudgetModal] = useState(false);
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState(0);
  const [duration, setDuration] = useState('');  
  const [history] = useState([]);
  const [firebaseUserId] = useState(localStorage.getItem('firebase_user_id') || '');
  const [deleteCount, setDeleteCount] = useState(0);
  const [createCount, setCreateCount] = useState(0);

  const handleCategoryChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setCategory(event.target.value);
  };

  const handleAmountChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(Number(event.target.value));
  };

  const handleDurationChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setDuration(event.target.value);
  };

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await create_expense();
    
    setCategory('');
    setAmount(0);
    setDuration('');
    setShowCreateExpenseModal(false);
    setShowExpenseModal(true);

    get_user_expenses(firebaseUserId);
  }

  const handleFormSubmit2 = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await create_budget();

    setAmount(0);
    setDuration('');
    setShowCreateBudgetModal(false);
    setShowBudgetModal(true);

    get_user_budgets(firebaseUserId);
  }

  useEffect(() => {
    localStorage.setItem('firebase_user_id', firebaseUserId);
  }, [firebaseUserId]);

  const fetchTransactions = async () => { 
    try {
      const response = await fetch(`${process.env.REACT_APP_API_HOST}/api/transactions?current_access_token=${tokenId}`);
      const data: TransactionsResponse = await response.json();
      console.log("Transactions response data:", data);
      setTransactionsData(data);
    } catch (error) {
      console.error("Error fetching transactions:", error);
    }
  };

  const fetchBalances = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_HOST}/api/balance?access_token=${tokenId}`);
      const data: BalancesResponse = await response.json();
      console.log("Balances response data:", data);
      setBalancesData(data);
    } catch (error) {
      console.error("Error fetching balances:", error);
    }
  };

  const create_expense = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_HOST}/api/expense/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amount,
          category: category,
          duration: duration,
          firebase_user_id: firebaseUserId,
          history: history
        }),
      });
      const data: ExpenseResponse = await response.json();
      console.log("Expense response data:", data);
      setExpenseData(data);
      if (data.success) {
        setCreateCount(createCount + 1);
      }
    } catch (error) {
      console.error("Error creating expense:", error);
    }
  };

  const delete_expense = async (expenseId: string) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_HOST}/api/expense/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          expense_id: expenseId,
          firebase_user_id: firebaseUserId,
        }),
      });
      const data = await response.json();
      if (data.success) {
        console.log("Expense deleted successfully");
        setDeleteCount(deleteCount + 1);
      }
    } catch (error) {
      console.error("Error deleting expense:", error);
    }
  };
  
  const get_user_expenses = async (firebaseUserId: string): Promise<void> => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_HOST}/api/expense/get?firebase_user_id=${firebaseUserId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      console.log("User's expenses:", data);
      if (data.success) {
        setExpenseData(data);
      } else {
        console.error("Error getting expenses:", data.error);
      }
    } catch (error) {
      console.error("Error getting expenses:", error);
    }
  };

  const create_budget = async () => {
    try {
      if (budgetData && budgetData.budgets && budgetData.budgets.length > 0) {
        edit_budget();
        get_user_budgets(firebaseUserId);
        return;
      }

      const response = await fetch(`${process.env.REACT_APP_API_HOST}/api/budget/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amount,
          duration: duration,
          firebase_user_id: firebaseUserId,
          history: history
        }),
      });
      const data: BudgetResponse = await response.json();
      console.log("Budget response data:", data);
      setBudgetData(data);
      if (data.success) {
        setCreateCount(createCount + 1);
      }
    } catch (error) {
      console.error("Error creating budget:", error);
    }
  };

  const edit_budget = async () => {
    try {
      let data;
      if (budgetData && budgetData.budgets && budgetData.budgets.length > 0) {
        const response = await fetch(`${process.env.REACT_APP_API_HOST}/api/budget/edit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            budget_id: budgetData.budgets[0].id,
            amount: amount,
            duration: duration,
            firebase_user_id: firebaseUserId,
            history: history
          }),
        });
        data = await response.json();
        setBudgetData(data);
      }
      if (data && data.success) {
        setCreateCount(createCount + 1);
      }
    } catch (error) {
      console.error("Error updating budget:", error);
    }
  };
  
  const get_user_budgets = async (firebaseUserId: string): Promise<void> => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_HOST}/api/budget/get?firebase_user_id=${firebaseUserId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      console.log("User's budget:", data);
      if (data.success) {
        setBudgetData(data);
      } else {
        console.error("Error getting budget:", data.error);
      }
    } catch (error) {
      console.error("Error getting budget:", error);
    }
  };

  const handleLogout = async () => { 
    try {
      await signOut(auth);
      setIsUserLoggedIn(false);
      navigate('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleConnect = async () => {
    try {
      setIsUserLoggedIn(true);
      navigate('/dashboard');
    } catch (error) {
      console.error('Error connecting:', error);
    }
  };

  useEffect(() => {
    fetchTransactions();
    fetchBalances();
  }, [tokenId]);

  useEffect(() => {
    console.log(transactionsData);
  }, [transactionsData]);

  useEffect(() => {
      get_user_expenses(firebaseUserId);
  }, [showExpenseModal, firebaseUserId]);

  useEffect(() => {
    get_user_budgets(firebaseUserId);
}, [showBudgetModal, firebaseUserId]);
  
  useEffect(() => {
    get_user_expenses(firebaseUserId);
  }, [deleteCount]);

  useEffect(() => {
    get_user_budgets(firebaseUserId);
  }, [deleteCount]);

  useEffect(() => {
    if (showCreateExpenseModal || showExpenseModal || showDeleteExpenseModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [showCreateExpenseModal || showExpenseModal || showDeleteExpenseModal]);

  useEffect(() => {
    if (showCreateBudgetModal || showBudgetModal || showDeleteBudgetModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [showCreateBudgetModal || showBudgetModal || showDeleteBudgetModal]);

  if (!balancesData || !transactionsData) {
    return <div>Loading...</div>;
  }

  const numPages = Math.ceil(transactionsData.latest_transactions.length / transactionsPerPage);
  const currentTransactions = transactionsData.latest_transactions.slice(currentPage * transactionsPerPage, (currentPage + 1) * transactionsPerPage);

  return (
    <section className="token section" id="token">
      <div className='token-container'>
        <h1 className="token__title">User Accounts</h1>
        <span className="token__subtitle">Account Details</span>

        <div className="connect-container">
          <button className="connect-btn" onClick={() => setShowConnectModal(true)}>Connect Another Account</button>
        </div>

        {showConnectModal && (
          <div className="modal-connect">
            <div className="modal-content-connect">
              <h2>Confirm Connect</h2>
              <p>Are you sure you want to connect another bank account?</p>
              <button className="yes" onClick={handleConnect}>Yes</button>
              <button className="no" onClick={() => setShowConnectModal(false)}>No</button>
            </div>
          </div>
        )}

        <div className="eb-container">
          <button className="logout-btn" onClick={() => setShowExpenseModal(true)}>Expenses</button>
          <button className="logout-btn" onClick={() => setShowBudgetModal(true)}>Budget</button>
        </div>

        {showExpenseModal && (
        <div className="modal">
          <div className="modal-content">
            <h2 className="modal-h2">Your Expenses</h2>
            {expenseData && expenseData.expenses && expenseData.expenses.map((expense: Expense, index: number) => (
              <div key={index} className="expense-item">
                <p className="expense-detail"><span className="expense-label">Category:</span> {expense.category}</p>
                <p className="expense-detail"><span className="expense-label">Duration:</span> {expense.duration}</p>
                <p className="expense-detail"><span className="expense-label">Amount:</span> ${expense.amount}</p>
              </div>
              ))}
              <p className="expense-total"><span className="expense-label">Total:</span> ${expenseData && expenseData.expenses && expenseData.expenses.reduce((total, expense) => total + expense.amount, 0).toFixed(2)}</p>
              <button className="yes" onClick={() => setShowCreateExpenseModal(true)}>Create Expense</button>
              <button className="yes" onClick={() => setShowDeleteExpenseModal(true)}>Delete Expense</button>
              <button className="no" onClick={() => setShowExpenseModal(false)}>Cancel</button>
            </div>
          </div>
        )}

        {showCreateExpenseModal && (
          <div className="modal-c">
            <div className="modal-content-c">
              <h2 className="modal-h2">Create An Expense</h2>
              <form onSubmit={handleFormSubmit}>
                <label className="label">
                  <span>Category:</span>
                  <input type="text" value={category} onChange={handleCategoryChange} required/>
                </label>
                <label className="label">
                  <span>Amount:</span>
                  <input type="number" value={amount || ''} onChange={handleAmountChange} required/>
                </label>
                <label className="label">
                  <span>Duration:</span>
                  <input type="text" value={duration} onChange={handleDurationChange} required/>
                </label>
                <input type="submit" value="Create Expense" className="yes-" />
              </form>
              <button className="no" onClick={() => setShowCreateExpenseModal(false)}>Cancel</button>
            </div>
          </div>
        )}

        {showDeleteExpenseModal && (
        <div className="modal-d">
          <div className="modal-content-d">
            <h2 className="modal-h2">Your Expenses</h2>
            {expenseData && expenseData.expenses && expenseData.expenses.map((expense: Expense, index: number) => (
              <div key={index} className="expense-item">
                <p className="expense-detail"><span className="expense-label">Category:</span> {expense.category}</p>
                <p className="expense-detail"><span className="expense-label">Duration:</span> {expense.duration}</p>
                <p className="expense-detail"><span className="expense-label">Amount:</span> ${expense.amount}</p>
                <button className="trash-btn" onClick={() => delete_expense(expense.id)}>
                  <FontAwesomeIcon icon={faTrash} size="lg" />
                </button>
              </div>
              ))}
              <p className="expense-total"><span className="expense-label">Total:</span> ${expenseData && expenseData.expenses && expenseData.expenses.reduce((total, expense) => total + expense.amount, 0).toFixed(2)}</p>
              <button className="no" onClick={() => setShowDeleteExpenseModal(false)}>Cancel</button>
            </div>
          </div>
        )}

        {showBudgetModal && (
        <div className="modal">
          <div className="modal-content">
            <h2 className="modal-h2">Your Budget</h2>
            {budgetData && budgetData.budgets && budgetData.budgets.map((budget: Budget, index: number) => (
              <div key={index} className="budget-item">
                <p className="budget-detail"><span className="budget-label">Budget Duration:</span> {budget.duration}</p>
                <p className="budget-detail"><span className="budget-label">Budget Amount:</span> ${budget.amount}</p>
              </div>
              ))}
              {expenseData && expenseData.expenses && expenseData.expenses.map((expense: Expense, index: number) => (
              <div key={index} className="expense-item">
                <p className="expense-detail"><span className="expense-label">Category:</span> {expense.category}</p>
                <p className="expense-detail"><span className="expense-label">Duration:</span> {expense.duration}</p>
                <p className="expense-detail"><span className="expense-label">Amount:</span> ${expense.amount}</p>
              </div>
              ))}
              <p className="expense-total-2"><span className="expense-label">Expense Total:</span> ${expenseData && expenseData.expenses && expenseData.expenses.reduce((total, expense) => total + expense.amount, 0).toFixed(2)}</p>
              <p className="budget-remaining">
                <span className="budget-total-label">Remaining Budget: </span> 
                ${((budgetData && budgetData.budgets ? budgetData.budgets.reduce((total, budget) => total + budget.amount, 0) : 0) - 
                (expenseData && expenseData.expenses ? parseFloat(expenseData.expenses.reduce((total, expense) => total + expense.amount, 0).toFixed(2)) : 0)).toFixed(2)}
              </p>     
              <button className="yes" onClick={() => setShowCreateBudgetModal(true)}>Create Budget</button>
              <button className="no" onClick={() => setShowBudgetModal(false)}>Cancel</button>
            </div>
          </div>
        )}

        {showCreateBudgetModal && (
          <div className="modal-c">
            <div className="modal-content-c">
              <h2 className="modal-h2">Create A Budget</h2>
              <form onSubmit={handleFormSubmit2}>
                <label className="label">
                  <span>Amount:</span>
                  <input type="number" value={amount || ''} onChange={handleAmountChange} required/>
                </label>
                <label className="label">
                  <span>Duration:</span>
                  <input type="text" value={duration} onChange={handleDurationChange} required/>
                </label>
                <input type="submit" value="Create Budget" className="yes-" />
              </form>
              <button className="no" onClick={() => setShowCreateBudgetModal(false)}>Cancel</button>
            </div>
          </div>
        )}

        <div className="connect-container">
          <button className="logout-btn" onClick={() => setShowLogoutModal(true)}>Logout</button>
        </div>

        {showLogoutModal && (
          <div className="modal-connect">
            <div className="modal-content-connect">
              <h2>Confirm Logout</h2>
              <p>Are you sure you want to log out?</p>
              <button className="yes" onClick={handleLogout}>Yes</button>
              <button className="no" onClick={() => setShowLogoutModal(false)}>No</button>
            </div>
          </div>
        )}

        <div className="parent-container">
          <div>
            <h3>Accounts</h3>
            <div className="accounts-container">
              {balancesData.accounts.map((account, index) => (
              <div key={account.account_id} className="account-card">
                <p><span className="bold-label">Name:</span> {account.name}</p>
                <p><span className="bold-label">Official Name:</span> {account.official_name}</p>
                <p><span className="bold-label">Type:</span> {account.subtype}</p>
              </div>
              ))}
            </div>
          </div>

          <div>
            <h3>Balances</h3>
            <div className="balances-container">
              {balancesData.accounts.map((account, index) => (
              <div key={account.account_id} className="balance-card">
                <p><span className="bold-label">Name:</span> {account.name}</p>
                <p><span className="bold-label">Available Balance:</span> {account.balances.available}</p>
                <p><span className="bold-label">Current Balance:</span> {account.balances.current}</p>
                <p><span className="bold-label">Limit:</span> {account.balances.limit ?? "N/A"}</p>
              </div>
              ))}
            </div>
          </div>
        </div>

        <h3>Latest Transactions</h3>
        <div className="transactions-container">
          {currentTransactions.map((transaction) => (
          <div key={transaction.transaction_id} className="transaction-card">
            <p><span className="bold-label">Name:</span> {transaction.name}</p>
            <p><span className="bold-label">Amount:</span> ${transaction.amount}</p>
            <p><span className="bold-label">Date:</span> {transaction.date}</p>
            <p><span className="bold-label">Merchant Name:</span> {transaction.merchant_name ?? "N/A"}</p>
            <p><span className="bold-label">Category:</span> {transaction.category.join(", ")}</p>
            <p><span className="bold-label">Pending:</span> {transaction.pending ? "Yes" : "No"}</p>
          </div> 
          ))}
        </div>

        <div className="button-container">
          <button className="page-button" onClick={() => setCurrentPage((oldPage) => Math.max(oldPage - 1, 0))}>Previous Page</button>
          <button className="page-button" onClick={() => setCurrentPage((oldPage) => Math.min(oldPage + 1, numPages - 1))}>Next Page</button>
        </div>
      </div>
    </section>
  );
};

export default AccessTokenDetails;