# source /Users/tnappy/node_projects/quickstart/python/bin/activate
# Read env vars from .env file
import base64
import os
import datetime as dt
import json
import time
import sys
import subprocess
import firebase_admin
from transformers import pipeline
from firebase_admin import db
from firebase_admin import credentials
from firebase_admin import firestore
import flask
from dotenv import load_dotenv
from flask import Flask, request, jsonify
from flask_cors import CORS
import plaid
from plaid.model.payment_amount import PaymentAmount
from plaid.model.payment_amount_currency import PaymentAmountCurrency
from plaid.model.products import Products
from plaid.model.country_code import CountryCode
from plaid.model.recipient_bacs_nullable import RecipientBACSNullable
from plaid.model.payment_initiation_address import PaymentInitiationAddress
from plaid.model.payment_initiation_recipient_create_request import PaymentInitiationRecipientCreateRequest
from plaid.model.payment_initiation_payment_create_request import PaymentInitiationPaymentCreateRequest
from plaid.model.payment_initiation_payment_get_request import PaymentInitiationPaymentGetRequest
from plaid.model.link_token_create_request_payment_initiation import LinkTokenCreateRequestPaymentInitiation
from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from plaid.model.asset_report_create_request import AssetReportCreateRequest
from plaid.model.asset_report_create_request_options import AssetReportCreateRequestOptions
from plaid.model.asset_report_user import AssetReportUser
from plaid.model.asset_report_get_request import AssetReportGetRequest
from plaid.model.asset_report_pdf_get_request import AssetReportPDFGetRequest
from plaid.model.auth_get_request import AuthGetRequest
from plaid.model.transactions_sync_request import TransactionsSyncRequest
from plaid.model.identity_get_request import IdentityGetRequest
from plaid.model.investments_transactions_get_request_options import InvestmentsTransactionsGetRequestOptions
from plaid.model.investments_transactions_get_request import InvestmentsTransactionsGetRequest
from plaid.model.accounts_balance_get_request import AccountsBalanceGetRequest
from plaid.model.accounts_get_request import AccountsGetRequest
from plaid.model.investments_holdings_get_request import InvestmentsHoldingsGetRequest
from plaid.model.item_get_request import ItemGetRequest
from plaid.model.institutions_get_by_id_request import InstitutionsGetByIdRequest
from plaid.model.transfer_authorization_create_request import TransferAuthorizationCreateRequest
from plaid.model.transfer_create_request import TransferCreateRequest
from plaid.model.transfer_get_request import TransferGetRequest
from plaid.model.transfer_network import TransferNetwork
from plaid.model.transfer_type import TransferType
from plaid.model.transfer_authorization_user_in_request import TransferAuthorizationUserInRequest
from plaid.model.ach_class import ACHClass
from plaid.model.transfer_create_idempotency_key import TransferCreateIdempotencyKey
from plaid.model.transfer_user_address_in_request import TransferUserAddressInRequest
from plaid.api import plaid_api

load_dotenv()


app = Flask(__name__)
CORS(app, origins=['https://thefiscalful.com'])

@app.route('/')
def home():
    return "Server is running"

# Fill in your Plaid API keys - https://dashboard.plaid.com/account/keys
PLAID_CLIENT_ID = os.getenv('PLAID_CLIENT_ID')
PLAID_SECRET = os.getenv('PLAID_SECRET')
# Use 'sandbox' to test with Plaid's Sandbox environment (username: user_good,
# password: pass_good)
# Use `development` to test with live users and credentials and `production`
# to go live
PLAID_ENV = os.getenv('PLAID_ENV', 'sandbox')
# PLAID_PRODUCTS is a comma-separated list of products to use when initializing
# Link. Note that this list must contain 'assets' in order for the app to be
# able to create and retrieve asset reports.
PLAID_PRODUCTS = os.getenv('PLAID_PRODUCTS', 'transactions').split(',')

# PLAID_COUNTRY_CODES is a comma-separated list of countries for which users
# will be able to select institutions from.
PLAID_COUNTRY_CODES = os.getenv('PLAID_COUNTRY_CODES', 'US').split(',')

# Firebase setup
# Replace with your service account key file
cred = credentials.Certificate("./firebase_credentials.json")
firebase_admin.initialize_app(cred)
db = firestore.client()


def empty_to_none(field):
    value = os.getenv(field)
    if value is None or len(value) == 0:
        return None
    return value


host = plaid.Environment.Sandbox

if PLAID_ENV == 'sandbox':
    host = plaid.Environment.Sandbox

if PLAID_ENV == 'development':
    host = plaid.Environment.Development

if PLAID_ENV == 'production':
    host = plaid.Environment.Production

# Parameters used for the OAuth redirect Link flow.
#
# Set PLAID_REDIRECT_URI to 'http://localhost:3000/'
# The OAuth redirect flow requires an endpoint on the developer's website
# that the bank website should redirect to. You will need to configure
# this redirect URI for your client ID through the Plaid developer dashboard
# at https://dashboard.plaid.com/team/api.
PLAID_REDIRECT_URI = empty_to_none('PLAID_REDIRECT_URI')

configuration = plaid.Configuration(
    host=host,
    api_key={
        'clientId': PLAID_CLIENT_ID,
        'secret': PLAID_SECRET,
        'plaidVersion': '2020-09-14'
    }
)

api_client = plaid.ApiClient(configuration)
client = plaid_api.PlaidApi(api_client)

products = []
for product in PLAID_PRODUCTS:
    products.append(Products(product))


# We store the access_token in memory - in production, store it in a secure
# persistent data store.
access_token = None
# The payment_id is only relevant for the UK Payment Initiation product.
# We store the payment_id in memory - in production, store it in a secure
# persistent data store.
payment_id = None
# The transfer_id is only relevant for Transfer ACH product.
# We store the transfer_id in memory - in production, store it in a secure
# persistent data store.
transfer_id = None

item_id = None


@app.route('/api/info', methods=['POST'])
def info():
    global access_token
    global item_id
    return jsonify({
        'item_id': item_id,
        'access_token': access_token,
        'products': PLAID_PRODUCTS
    })


@app.route('/api/create_link_token_for_payment', methods=['POST'])
def create_link_token_for_payment():
    global payment_id
    try:
        request = PaymentInitiationRecipientCreateRequest(
            name='John Doe',
            bacs=RecipientBACSNullable(account='26207729', sort_code='560029'),
            address=PaymentInitiationAddress(
                street=['street name 999'],
                city='city',
                postal_code='99999',
                country='GB'
            )
        )
        response = client.payment_initiation_recipient_create(
            request)
        recipient_id = response['recipient_id']

        request = PaymentInitiationPaymentCreateRequest(
            recipient_id=recipient_id,
            reference='TestPayment',
            amount=PaymentAmount(
                PaymentAmountCurrency('GBP'),
                value=100.00
            )
        )
        response = client.payment_initiation_payment_create(
            request
        )
        pretty_print_response(response.to_dict())

        # We store the payment_id in memory for demo purposes - in production, store it in a secure
        # persistent data store along with the Payment metadata, such as userId.
        payment_id = response['payment_id']

        linkRequest = LinkTokenCreateRequest(
            # The 'payment_initiation' product has to be the only element in the 'products' list.
            products=[Products('payment_initiation')],
            client_name='Plaid Test',
            # Institutions from all listed countries will be shown.
            country_codes=list(
                map(lambda x: CountryCode(x), PLAID_COUNTRY_CODES)),
            language='en',
            user=LinkTokenCreateRequestUser(
                # This should correspond to a unique id for the current user.
                # Typically, this will be a user ID number from your application.
                # Personally identifiable information, such as an email address or phone number, should not be used here.
                client_user_id=str(time.time())
            ),
            payment_initiation=LinkTokenCreateRequestPaymentInitiation(
                payment_id=payment_id
            )
        )

        if PLAID_REDIRECT_URI != None:
            linkRequest['redirect_uri'] = PLAID_REDIRECT_URI
        linkResponse = client.link_token_create(linkRequest)
        pretty_print_response(linkResponse.to_dict())
        return jsonify(linkResponse.to_dict())
    except plaid.ApiException as e:
        return json.loads(e.body)


@app.route('/api/create_link_token', methods=['POST'])
def create_link_token():
    try:
        request = LinkTokenCreateRequest(
            products=products,
            client_name="Plaid Quickstart",
            country_codes=list(
                map(lambda x: CountryCode(x), PLAID_COUNTRY_CODES)),
            language='en',
            user=LinkTokenCreateRequestUser(
                client_user_id=str(time.time())
            )
        )
        if PLAID_REDIRECT_URI != None:
            request['redirect_uri'] = PLAID_REDIRECT_URI
    # create link token
        response = client.link_token_create(request)
        return jsonify(response.to_dict())
    except plaid.ApiException as e:
        return json.loads(e.body)


# Exchange token flow - exchange a Link public_token for
# an API access_token
# https://plaid.com/docs/#exchange-token-flow


@app.route('/api/set_access_token', methods=['POST'])
def get_access_token():
    global access_token
    global item_id
    global transfer_id
    public_token = request.form['public_token']
    firebase_user_id = request.form['firebase_user_id']
    try:
        exchange_request = ItemPublicTokenExchangeRequest(
            public_token=public_token)
        exchange_response = client.item_public_token_exchange(exchange_request)
        access_token = exchange_response['access_token']
        item_id = exchange_response['item_id']
        item_access_token = {
            "firebase_user_id": firebase_user_id,
            "access_token": access_token
        }
        pretty_print_response(exchange_response.to_dict())
        db.collection("item_access_tokens").add(item_access_token)
        return jsonify(exchange_response.to_dict())
    except plaid.ApiException as e:
        return json.loads(e.body)


# Retrieve ACH or ETF account numbers for an Item
# https://plaid.com/docs/#auth


@app.route('/api/auth', methods=['GET'])
def get_auth():
    try:
        request = AuthGetRequest(
            access_token=access_token
        )
        response = client.auth_get(request)
        pretty_print_response(response.to_dict())
        return jsonify(response.to_dict())
    except plaid.ApiException as e:
        error_response = format_error(e)
        return jsonify(error_response)


# Retrieve Transactions for an Item
# https://plaid.com/docs/#transactions


@app.route('/api/transactions', methods=['GET'])
def get_transactions():
    # Set cursor to empty to receive all historical updates
    cursor = ''

    # New transaction updates since "cursor"
    added = []
    modified = []
    removed = []  # Removed transaction ids
    has_more = True
    try:
        # Iterate through each page of new transaction updates for item
        while has_more:
            request = TransactionsSyncRequest(
                access_token=access_token,
                cursor=cursor,
            )
            response = client.transactions_sync(request).to_dict()
            # Add this page of results
            added.extend(response['added'])
            modified.extend(response['modified'])
            removed.extend(response['removed'])
            has_more = response['has_more']
            # Update cursor to the next cursor
            cursor = response['next_cursor']
            pretty_print_response(response)

        # Return the 8 most recent transactions
        latest_transactions = sorted(added, key=lambda t: t['date'])
        return jsonify({
            'latest_transactions': latest_transactions})

    except plaid.ApiException as e:
        error_response = format_error(e)
        return jsonify(error_response)


# Retrieve Identity data for an Item
# https://plaid.com/docs/#identity


@app.route('/api/identity', methods=['GET'])
def get_identity():
    try:
        request = IdentityGetRequest(
            access_token=access_token
        )
        response = client.identity_get(request)
        pretty_print_response(response.to_dict())
        return jsonify(
            {'error': None, 'identity': response.to_dict()['accounts']})
    except plaid.ApiException as e:
        error_response = format_error(e)
        return jsonify(error_response)


# Retrieve real-time balance data for each of an Item's accounts
# https://plaid.com/docs/#balance


@app.route('/api/balance', methods=['GET'])
def get_balance():
    try:
        request = AccountsBalanceGetRequest(
            access_token=access_token
        )
        response = client.accounts_balance_get(request)
        pretty_print_response(response.to_dict())
        return jsonify(response.to_dict())
    except plaid.ApiException as e:
        error_response = format_error(e)
        return jsonify(error_response)


# Retrieve an Item's accounts
# https://plaid.com/docs/#accounts


@app.route('/api/accounts', methods=['GET'])
def get_accounts():
    try:
        request = AccountsGetRequest(
            access_token=access_token
        )
        response = client.accounts_get(request)
        pretty_print_response(response.to_dict())
        return jsonify(response.to_dict())
    except plaid.ApiException as e:
        error_response = format_error(e)
        return jsonify(error_response)


# Create and then retrieve an Asset Report for one or more Items. Note that an
# Asset Report can contain up to 100 items, but for simplicity we're only
# including one Item here.
# https://plaid.com/docs/#assets


@app.route('/api/assets', methods=['GET'])
def get_assets():
    try:
        request = AssetReportCreateRequest(
            access_tokens=[access_token],
            days_requested=60,
            options=AssetReportCreateRequestOptions(
                webhook='https://www.example.com',
                client_report_id='123',
                user=AssetReportUser(
                    client_user_id='789',
                    first_name='Jane',
                    middle_name='Leah',
                    last_name='Doe',
                    ssn='123-45-6789',
                    phone_number='(555) 123-4567',
                    email='jane.doe@example.com',
                )
            )
        )

        response = client.asset_report_create(request)
        pretty_print_response(response.to_dict())
        asset_report_token = response['asset_report_token']
    except plaid.ApiException as e:
        error_response = format_error(e)
        return jsonify(error_response)

    # Poll for the completion of the Asset Report.
    num_retries_remaining = 20
    asset_report_json = None
    err = None
    while num_retries_remaining > 0:
        try:
            request = AssetReportGetRequest(
                asset_report_token=asset_report_token,
            )
            response = client.asset_report_get(request)
            asset_report_json = response['report']
            break
        except plaid.ApiException as e:
            response = json.loads(e.body)
            if response['error_code'] == 'PRODUCT_NOT_READY':
                err = e
                num_retries_remaining -= 1
                time.sleep(1)
                continue
            else:
                error_response = format_error(e)
                return jsonify(error_response)
    if asset_report_json is None:
        return jsonify({'error': {'status_code': err.status, 'display_message':
                                  'Timed out when polling for Asset Report', 'error_code': '', 'error_type': ''}})
    try:
        request = AssetReportPDFGetRequest(
            asset_report_token=asset_report_token,
        )
        pdf = client.asset_report_pdf_get(request)
        return jsonify({
            'error': None,
            'json': asset_report_json.to_dict(),
            'pdf': base64.b64encode(pdf.read()).decode('utf-8'),
        })
    except plaid.ApiException as e:
        error_response = format_error(e)
        return jsonify(error_response)


# Retrieve investment holdings data for an Item
# https://plaid.com/docs/#investments


@app.route('/api/holdings', methods=['GET'])
def get_holdings():
    try:
        request = InvestmentsHoldingsGetRequest(access_token=access_token)
        response = client.investments_holdings_get(request)
        pretty_print_response(response.to_dict())
        return jsonify({'error': None, 'holdings': response.to_dict()})
    except plaid.ApiException as e:
        error_response = format_error(e)
        return jsonify(error_response)


# Retrieve Investment Transactions for an Item
# https://plaid.com/docs/#investments


@app.route('/api/investments_transactions', methods=['GET'])
def get_investments_transactions():
    # Pull transactions for the last 30 days

    start_date = (dt.datetime.now() - dt.timedelta(days=(30)))
    end_date = dt.datetime.now()
    try:
        options = InvestmentsTransactionsGetRequestOptions()
        request = InvestmentsTransactionsGetRequest(
            access_token=access_token,
            start_date=start_date.date(),
            end_date=end_date.date(),
            options=options
        )
        response = client.investments_transactions_get(
            request)
        pretty_print_response(response.to_dict())
        return jsonify(
            {'error': None, 'investments_transactions': response.to_dict()})

    except plaid.ApiException as e:
        error_response = format_error(e)
        return jsonify(error_response)

# This functionality is only relevant for the ACH Transfer product.
# Authorize a transfer


@app.route('/api/transfer_authorize', methods=['GET'])
def transfer_authorization():
    global authorization_id
    global account_id
    request = AccountsGetRequest(access_token=access_token)
    response = client.accounts_get(request)
    account_id = response['accounts'][0]['account_id']
    try:
        request = TransferAuthorizationCreateRequest(
            access_token=access_token,
            account_id=account_id,
            type=TransferType('debit'),
            network=TransferNetwork('ach'),
            amount='1.00',
            ach_class=ACHClass('ppd'),
            user=TransferAuthorizationUserInRequest(
                legal_name='FirstName LastName',
                email_address='foobar@email.com',
                address=TransferUserAddressInRequest(
                    street='123 Main St.',
                    city='San Francisco',
                    region='CA',
                    postal_code='94053',
                    country='US'
                ),
            ),
        )
        response = client.transfer_authorization_create(request)
        pretty_print_response(response.to_dict())
        authorization_id = response['authorization']['id']
        return jsonify(response.to_dict())
    except plaid.ApiException as e:
        error_response = format_error(e)
        return jsonify(error_response)

# Create Transfer for a specified Transfer ID


@app.route('/api/transfer_create', methods=['GET'])
def transfer():
    try:
        request = TransferCreateRequest(
            access_token=access_token,
            account_id=account_id,
            authorization_id=authorization_id,
            description='Debit')
        response = client.transfer_create(request)
        pretty_print_response(response.to_dict())
        return jsonify(response.to_dict())
    except plaid.ApiException as e:
        error_response = format_error(e)
        return jsonify(error_response)

# This functionality is only relevant for the UK Payment Initiation product.
# Retrieve Payment for a specified Payment ID


@app.route('/api/payment', methods=['GET'])
def payment():
    global payment_id
    try:
        request = PaymentInitiationPaymentGetRequest(payment_id=payment_id)
        response = client.payment_initiation_payment_get(request)
        pretty_print_response(response.to_dict())
        return jsonify({'error': None, 'payment': response.to_dict()})
    except plaid.ApiException as e:
        error_response = format_error(e)
        return jsonify(error_response)


# Retrieve high-level information about an Item
# https://plaid.com/docs/#retrieve-item

@app.route('/api/item', methods=['GET'])
def item():
    try:
        request = ItemGetRequest(access_token=access_token)
        response = client.item_get(request)
        request = InstitutionsGetByIdRequest(
            institution_id=response['item']['institution_id'],
            country_codes=list(
                map(lambda x: CountryCode(x), PLAID_COUNTRY_CODES))
        )
        institution_response = client.institutions_get_by_id(request)
        pretty_print_response(response.to_dict())
        pretty_print_response(institution_response.to_dict())
        return jsonify({'error': None, 'item': response.to_dict()[
            'item'], 'institution': institution_response.to_dict()['institution']})
    except plaid.ApiException as e:
        error_response = format_error(e)
        return jsonify(error_response)


@app.route('/api/get_tokens_for_user', methods=['GET'])
def get_tokens_for_user():
    """
    Takes in firebase_user_id of current user, returns all access_tokens that contain the firebase key
    """
    firebase_user_id = request.args.get('firebase_user_id')
    collection = db.collection("item_access_tokens")
    result = collection.where("firebase_user_id", "==", firebase_user_id).get()
    access_tokens = [token.to_dict() for token in result]
    return jsonify(access_tokens)


@app.route('/api/start_worker', methods=['POST'])
def start_worker():
    """
    Function to start worker and save transactions report into a database
    """
    current_dir = os.path.dirname(os.path.abspath(__file__))
    worker_path = os.path.join(current_dir, 'worker.py')
    firebase_user_id = request.json.get('firebase_user_id')
    subprocess.Popen([sys.executable, worker_path, firebase_user_id])
    return 'Worker started for user {}'.format(firebase_user_id)


@app.route('/api/item_transactions', methods=['GET'])
def get_item_transactions():
    cursor = ''
    current_access_token = flask.request.args.get('current_access_token')
    added = []
    modified = []
    removed = []  # Removed transaction ids
    has_more = True
    try:
        # Iterate through each page of new transaction updates for item
        while has_more:
            request = TransactionsSyncRequest(
                access_token=current_access_token,
                cursor=cursor,
            )
            response = client.transactions_sync(request).to_dict()
            # Add this page of results
            added.extend(response['added'])
            modified.extend(response['modified'])
            removed.extend(response['removed'])
            has_more = response['has_more']
            # Update cursor to the next cursor
            cursor = response['next_cursor']
            pretty_print_response(response)

        # Return the 8 most recent transactions
        latest_transactions = sorted(added, key=lambda t: t['date'])
        return jsonify({
            'latest_transactions': latest_transactions})

    except plaid.ApiException as e:
        error_response = format_error(e)
        return jsonify(error_response)


@app.route('/api/ask_chatbot', methods=['GET'])
def ask_chatbot():
    """
    IN PROGRESS
    Fetches the account report from the Firebase document, preprocesses it,
    and asks the chatbot using an LLM.
    """
    firebase_user_id = request.args.get('firebase_user_id')
    prompt = request.args.get('prompt')
    doc_ref = db.collection('account_reports').document(firebase_user_id)
    doc = doc_ref.get()

    if doc.exists:
        transaction_history = doc.to_dict()
        full_prompt = f"{prompt}\n{transaction_history}"
    else:
        return jsonify({'error': 'Document not found'}), 404

@app.route('/api/expense/get', methods=['GET'])
def get_user_expenses():
    firebase_user_id = request.args.get('firebase_user_id')
    try:
        expense_docs = db.collection("expenses").where("firebase_user_id", "==", firebase_user_id).get()
        expenses = []

        if expense_docs:
            for expense_doc in expense_docs:
                expense_data = expense_doc.to_dict()
                expense_data['id'] = expense_doc.id
                expenses.append(expense_data)

            return jsonify({'success': True, 'expenses': expenses}), 200
        else:
            return jsonify({'success': False, 'error': 'No expenses found for the user'}), 404
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    
@app.route('/api/expense/create', methods=['POST'])
def create_expense():
    amount = request.json.get('amount')
    category = request.json.get('category')
    duration = request.json.get('duration')
    history = []
    firebase_user_id = request.json.get('firebase_user_id')
    expense_data = {
        'amount': amount,
        'category': category,
        'duration': duration,
        'firebase_user_id': firebase_user_id,
        'history': history
    }
    try:
        expense_ref = db.collection("expenses").add(expense_data)
        expense_id = expense_ref[1].id
        return jsonify({'success': True, 'expense_id': expense_id}), 201
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/expense/delete', methods=['POST'])
def delete_expense():
    expense_id = request.json.get('expense_id')
    firebase_user_id = request.json.get('firebase_user_id')

    try:
        expense_ref = db.collection("expenses").document(expense_id)

        expense_doc = expense_ref.get()

        if expense_doc.exists and expense_doc.to_dict().get('firebase_user_id') == firebase_user_id:
            expense_ref.delete()
            return jsonify({'success': True, 'message': 'expense deleted successfully'}), 200
        else:
            return jsonify({'success': False, 'error': 'expense not found or unauthorized access'}), 404

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/expense/edit', methods=['POST'])
def edit_expense():
    expense_id = request.json.get('expense_id')
    firebase_user_id = request.json.get('firebase_user_id')
    amount = request.json.get('amount')
    change = request.json.get('change')
    category = request.json.get('category')
    duration = request.json.get('duration')

    try:
        expense_ref = db.collection("expenses").document(expense_id)
        expense_doc = expense_ref.get()

        if expense_doc.exists and expense_doc.to_dict().get('firebase_user_id') == firebase_user_id:
            expense_data = expense_doc.to_dict()
            history = expense_data.get('history', [])
            history.append(change)
            old_amount = expense_data.get("amount")
            old_category = expense_data.get("category")
            old_duration = expense_data.get("duration")
            expense_ref.update({
                'amount': amount if amount else old_amount,
                'category': category if category else old_category,
                'duration': duration if duration else old_duration,
                'history': history
            })

            return jsonify({'success': True, 'message': 'expense updated successfully'}), 200
        else:
            return jsonify({'success': False, 'error': 'expense not found or unauthorized access'}), 404
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/budget/get', methods=['GET'])
def get_user_budgets():
    firebase_user_id = request.args.get('firebase_user_id')
    try:
        budget_docs = db.collection("budgets").where("firebase_user_id", "==", firebase_user_id).get()
        budgets = []

        if budget_docs:
            for budget_doc in budget_docs:
                budget_data = budget_doc.to_dict()
                budget_data['id'] = budget_doc.id
                budgets.append(budget_data)

            return jsonify({'success': True, 'budgets': budgets}), 200
        else:
            return jsonify({'success': False, 'error': 'No budgets found for the user'}), 404
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    
@app.route('/api/budget/create', methods=['POST'])
def create_budget():
    amount = request.json.get('amount')
    duration = request.json.get('duration')
    history = []
    firebase_user_id = request.json.get('firebase_user_id')
    budget_data = {
        'amount': amount,
        'duration': duration,
        'firebase_user_id': firebase_user_id,
        'history': history
    }
    try:
        budget_ref = db.collection("budgets").add(budget_data)
        budget_id = budget_ref[1].id
        return jsonify({'success': True, 'budget_id': budget_id}), 201
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/budget/edit', methods=['POST'])
def edit_budget():
    budget_id = request.json.get('budget_id')
    firebase_user_id = request.json.get('firebase_user_id')
    change = request.json.get('change')
    amount = request.json.get('amount')
    duration = request.json.get('duration')

    try:
        budget_ref = db.collection("budgets").document(budget_id)
        budget_doc = budget_ref.get()

        if budget_doc.exists and budget_doc.to_dict().get('firebase_user_id') == firebase_user_id:
            budget_data = budget_doc.to_dict()
            history = budget_data.get('history', [])
            history.append(change)
            old_amount = budget_data.get("amount")
            old_duration = budget_data.get("duration")
            budget_ref.update({
                'amount': amount if amount else old_amount,
                'duration': duration if duration else old_duration,
                'history': history
            })

            return jsonify({'success': True, 'message': 'budget updated successfully'}), 200
        else:
            return jsonify({'success': False, 'error': 'budget not found or unauthorized access'}), 404
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/budget/delete', methods=['POST'])
def delete_budget():
    budget_id = request.json.get('budget_id')
    firebase_user_id = request.json.get('firebase_user_id')

    try:
        budget_ref = db.collection("budgets").document(budget_id)

        budget_doc = budget_ref.get()

        if budget_doc.exists and budget_doc.to_dict().get('firebase_user_id') == firebase_user_id:
            budget_ref.delete()
            return jsonify({'success': True, 'message': 'budget deleted successfully'}), 200
        else:
            return jsonify({'success': False, 'error': 'budget not found or unauthorized access'}), 404

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

def pretty_print_response(response):
    print(json.dumps(response, indent=2, sort_keys=True, default=str))


def format_error(e):
    response = json.loads(e.body)
    return {'error': {'status_code': e.status, 'display_message':
                      response['error_message'], 'error_code': response['error_code'], 'error_type': response['error_type']}}


if __name__ == '__main__':
    # app.run(port=int(os.getenv('PORT', 8000)))
    port = int(os.getenv('PORT', 10000))
    app.run(host='0.0.0.0', port=port, debug=True)
