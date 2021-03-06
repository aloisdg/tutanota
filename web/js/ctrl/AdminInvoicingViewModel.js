"use strict";

tutao.provide('tutao.tutanota.ctrl.AdminInvoicingViewModel');

tutao.tutanota.ctrl.AdminInvoicingViewModel = function() {
    tutao.util.FunctionUtils.bindPrototypeMethodsToThis(this);
    var self = this;

    this.business = ko.observable(false);
    this.users = ko.observable(0);
    this.storage = ko.observable(0);

    this.items = ko.observableArray();
    this.items.push({ type: tutao.entity.tutanota.TutanotaConstants.BOOKING_ITEM_FEATURE_TYPE_USERS, name: tutao.lang("bookingItemUsers_label"), currentAmount: ko.observable(0), nextAmount: ko.observable(0), currentPrice: ko.observable(0), nextPrice: ko.observable(0) });
    this.items.push({ type: tutao.entity.tutanota.TutanotaConstants.BOOKING_ITEM_FEATURE_TYPE_STORAGE, name: tutao.lang("bookingItemStorage_label") + " (GB)", currentAmount: ko.observable(0), nextAmount: ko.observable(0), currentPrice: ko.observable(0), nextPrice: ko.observable(0) });
    this.items.push({ type: tutao.entity.tutanota.TutanotaConstants.BOOKING_ITEM_FEATURE_TYPE_EMAIL_ALIASES, name: tutao.lang("mailAddressAliases_label"), currentAmount: ko.observable(0), nextAmount: ko.observable(0), currentPrice: ko.observable(0), nextPrice: ko.observable(0) });

    this.orderStatus = ko.observable({ type: "neutral", text: "emptyString_msg" });
    this.orderSubmitStatus = ko.observable({ type: "neutral", text: "emptyString_msg" });

    this.price = ko.observable();
    this.showNextPeriodInfo = ko.observable(false);
    this.invoices = ko.observableArray();
    this._updatingInvoiceStatus = ko.observable(false);

    this.accountType = ko.computed(function() {
        return "Tutanota " + tutao.entity.tutanota.TutanotaConstants.ACCOUNT_TYPE_NAMES[Number(tutao.locator.viewManager.getLoggedInUserAccountType())];
    });


    var user = tutao.locator.userController.getLoggedInUser();
    user.loadCustomer().then(function(customer) {
        return customer.loadCustomerInfo().then(function(customerInfo) {
            var storageCapacity = Math.max(Number(customerInfo.getIncludedStorageCapacity()), Number(customerInfo.getPromotionStorageCapacity()));
            var emailAliases = Math.max(Number(customerInfo.getIncludedEmailAliases()), Number(customerInfo.getPromotionEmailAliases()));

            self.items()[1].currentAmount(storageCapacity);
            self.items()[1].nextAmount(storageCapacity);
            self.items()[2].currentAmount(emailAliases);
            self.items()[2].nextAmount(emailAliases);

            customerInfo.loadAccountingInfo().then(function(accountingInfo) {
                return accountingInfo.loadInvoiceInfo().then(function(invoiceInfo) {
                    return tutao.rest.EntityRestInterface.loadAll(tutao.entity.sys.Invoice, invoiceInfo.getInvoices()).then(function(invoices) {
                        var publishedInvoices = [];
                        for (var i=0; i<invoices.length;i++) {
                            if (invoices[i].getStatus() != 0 && invoices[i].getStatus() != 6 && invoices[i].getStatus() != 7) {
                                publishedInvoices.push(invoices[i]);
                            }
                        }
                        self.invoices(publishedInvoices);
                    });
                }).then(function () {
                    if(customer.getType() == tutao.entity.tutanota.TutanotaConstants.ACCOUNT_TYPE_PREMIUM) { // only load prices for premium accounts.
                        return tutao.util.BookingUtils.getCurrentPrice().then(function (price) {
                            self.price(price);
                            for (var a = 0; a < self.items().length; a++) {
                                var item = self.items()[a];
                                var currentPriceItem = tutao.util.BookingUtils.getPriceItem(price.getCurrentPriceThisPeriod(), item.type);
                                if (currentPriceItem != null) {
                                    item.currentAmount(Number(currentPriceItem.getCount()));
                                    item.currentPrice(Number(currentPriceItem.getPrice()));
                                }

                                var nextPriceItem = tutao.util.BookingUtils.getPriceItem(price.getCurrentPriceNextPeriod(), item.type);
                                if (nextPriceItem != null) {
                                    item.nextAmount(Number(nextPriceItem.getCount()));
                                    item.nextPrice(Number(nextPriceItem.getPrice()));
                                }

                                if (item.nextAmount() != item.currentAmount() || item.nextPrice() != item.currentPrice()) {
                                    self.showNextPeriodInfo(true);
                                }
                            }

                        });
                    }
                });
            });
        });
    });
};

tutao.tutanota.ctrl.AdminInvoicingViewModel.prototype.getSubscriptionTextId = function() {
    if (!this.price()) {
        return 'loading_msg';
    } else {
        return (this.price().getCurrentPriceNextPeriod().getPaymentInterval() == 12) ? 'yearly_label' : 'monthly_label'
    }
};

tutao.tutanota.ctrl.AdminInvoicingViewModel.prototype.getEndOfSubscriptionText = function() {
    if (!this.price()) {
        return tutao.lang('loading_msg');
    } else {
        return tutao.lang("endOfSubscriptionPeriod_label", {"{1}": tutao.tutanota.util.Formatter.formatDate(this.price().getPeriodEndDate())});
    }
};

tutao.tutanota.ctrl.AdminInvoicingViewModel.prototype.getUsageTextId = function() {
    if (!this.price()) {
        return 'loading_msg';
    } else {
        return (this.price().getCurrentPriceNextPeriod().getTaxIncluded()) ? 'privateUse_label' : 'businessUse_label';
    }
};

tutao.tutanota.ctrl.AdminInvoicingViewModel.prototype.getNetGrossInfoTextId = function() {
    if (!this.price()) {
        return 'loading_msg';
    } else {
        return (this.price().getCurrentPriceNextPeriod().getTaxIncluded()) ? 'priceIncludesTaxes_msg' : 'priceExcludesTaxes_msg';
    }
};

tutao.tutanota.ctrl.AdminInvoicingViewModel.prototype.getAmountText = function(item) {
    if (!this.price()) {
        return tutao.lang('loading_msg');
    } else if (item.currentAmount() != item.nextAmount()) {
        return item.currentAmount() + " (" + item.nextAmount() + ")*";
    } else {
        return item.currentAmount();
    }
};

tutao.tutanota.ctrl.AdminInvoicingViewModel.prototype.getPriceText = function(item) {
    if (!this.price()) {
        return tutao.lang('loading_msg');
    } else if (item.currentPrice() != item.nextPrice()) {
        return tutao.util.BookingUtils.formatPrice(item.currentPrice(), false, tutao.locator.settingsViewModel.decimalSeparator()) + " (" + tutao.util.BookingUtils.formatPrice(item.nextPrice(), false, tutao.locator.settingsViewModel.decimalSeparator()) + ")*";
    } else {
        return tutao.util.BookingUtils.formatPrice(item.currentPrice(), false, tutao.locator.settingsViewModel.decimalSeparator());
    }
};

tutao.tutanota.ctrl.AdminInvoicingViewModel.prototype.getTotalPriceText = function() {
    if (!this.price()) {
        return tutao.lang('loading_msg');
    } else if (this.price().getCurrentPriceThisPeriod().getPrice() != this.price().getCurrentPriceNextPeriod().getPrice()) {
        return tutao.util.BookingUtils.formatPrice(Number(this.price().getCurrentPriceThisPeriod().getPrice()), false, tutao.locator.settingsViewModel.decimalSeparator()) + " (" + tutao.util.BookingUtils.formatPrice(Number(this.price().getCurrentPriceNextPeriod().getPrice()), false, tutao.locator.settingsViewModel.decimalSeparator()) + ")*";
    } else {
        return tutao.util.BookingUtils.formatPrice(Number(this.price().getCurrentPriceThisPeriod().getPrice()), false, tutao.locator.settingsViewModel.decimalSeparator());
    }
};


tutao.tutanota.ctrl.AdminInvoicingViewModel.prototype._calculatePrice = function(bookingItem) {
    var totalPrice = 0;
    if (bookingItem.getPriceType() == tutao.entity.tutanota.TutanotaConstants.BOOKING_ITEM_PRICE_TYPE_SINGLE){
        totalPrice = Number(bookingItem.getPrice()) * bookingItem.getMaxCount();
    } else if (bookingItem.getPriceType() == tutao.entity.tutanota.TutanotaConstants.BOOKING_ITEM_PRICE_TYPE_PACKAGE) {
        totalPrice = Number(bookingItem.getPrice());
    } else if (bookingItem.getPriceType() == tutao.entity.tutanota.TutanotaConstants.BOOKING_ITEM_PRICE_TYPE_TOTAL) {
        totalPrice = Number(bookingItem.getPrice());
    }
    return totalPrice;
};

tutao.tutanota.ctrl.AdminInvoicingViewModel.prototype.downloadPdf = function(invoice) {
    var data = new tutao.entity.sys.PdfInvoiceServiceData();
    data.setInvoice(invoice.getId());
    return tutao.entity.sys.PdfInvoiceServiceReturn.load(data, {}, null).then(function(returnData) {
        // the session key for the pdf data is the same as the invoice session key
        returnData.getEntityHelper().setSessionKey(invoice.getEntityHelper().getSessionKey());
        var pdfBytes = tutao.util.EncodingConverter.base64ToUint8Array(returnData.getData());
        var tmpFile = new tutao.entity.tutanota.File();
        tmpFile.setName(String(invoice.getNumber()) + ".pdf");
        tmpFile.setMimeType("application/pdf");
        tmpFile.setSize(String(pdfBytes.byteLength));
        tutao.locator.fileFacade.bytesToFile(pdfBytes, tmpFile).then(tutao.locator.fileFacade.open)
    });
};


/**
 * @param {tutao.entity.sys.Invoice} invoice
 */
tutao.tutanota.ctrl.AdminInvoicingViewModel.prototype.getInvoiceStateText = function(invoice) {
    if( invoice.getStatus() == tutao.entity.tutanota.TutanotaConstants.INVOICE_STATUS_PUBLISHEDFORAUTOMATIC
        || invoice.getStatus() == tutao.entity.tutanota.TutanotaConstants.INVOICE_STATUS_PUBLISHEDFORMANUAL
        || invoice.getStatus() == tutao.entity.tutanota.TutanotaConstants.INVOICE_STATUS_CREATED) {
        return tutao.lang('invoiceStateOpen_label');
    } else if (invoice.getStatus() == tutao.entity.tutanota.TutanotaConstants.INVOICE_STATUS_DEBITFAILED
        || invoice.getStatus() == tutao.entity.tutanota.TutanotaConstants.INVOICE_STATUS_FIRSTREMINDER
        || invoice.getStatus() == tutao.entity.tutanota.TutanotaConstants.INVOICE_STATUS_SECONDREMINDER) {
        if ( this._updatingInvoiceStatus()) {
            return tutao.lang('pleaseWait_msg');
        } else {
            return tutao.lang('invoiceStatePaymentFailed_label');
        }

    } else if (invoice.getStatus() == tutao.entity.tutanota.TutanotaConstants.INVOICE_STATUS_PAID) {
        return tutao.lang('invoiceStatePaid_label');
    } else if (invoice.getStatus() == tutao.entity.tutanota.TutanotaConstants.INVOICE_STATUS_DISPUTED) {
        return tutao.lang('invoiceStateResolving_label');
    } else if (invoice.getStatus() == tutao.entity.tutanota.TutanotaConstants.INVOICE_STATUS_REFUNDED || invoice.getStatus() == tutao.entity.tutanota.TutanotaConstants.INVOICE_STATUS_DISPUTEACCEPTED) {
        return tutao.lang('invoiceStateRefunded_label');
    } else if (invoice.getStatus() == tutao.entity.tutanota.TutanotaConstants.INVOICE_STATUS_CANCELLED) {
        return tutao.lang('invoiceStateCancelled_label');
    } else {
        return "";
    }
};


/**
 * @param {tutao.entity.sys.Invoice} invoice
 */
tutao.tutanota.ctrl.AdminInvoicingViewModel.prototype.isPayButtonEnabled = function(invoice) {
    return !this._updatingInvoiceStatus()
        && (invoice.getPaymentMethod() == tutao.entity.tutanota.TutanotaConstants.PAYMENT_METHOD_CREDIT_CARD || invoice.getPaymentMethod() == tutao.entity.tutanota.TutanotaConstants.PAYMENT_METHOD_PAY_PAL)
        && (invoice.getStatus() == tutao.entity.tutanota.TutanotaConstants.INVOICE_STATUS_FIRSTREMINDER  || invoice.getStatus() == tutao.entity.tutanota.TutanotaConstants.INVOICE_STATUS_SECONDREMINDER);
};



/**
 * @param {tutao.entity.sys.Invoice} invoice
 */
tutao.tutanota.ctrl.AdminInvoicingViewModel.prototype.payInvoice = function(invoice) {
    if ( !this.isPayButtonEnabled(invoice) ) {
        return;
    }
    this._updatingInvoiceStatus(true);
    var self = this;
    var confirmMessage = tutao.lang( "invoicePayConfirm_msg", { "{invoiceNumber}" : invoice.getNumber(), "{invoiceDate}" : tutao.tutanota.util.Formatter.formatDate(invoice.getDate())});
    var priceMessage = tutao.lang('bookingTotalPrice_label') + ": " + tutao.util.BookingUtils.formatPrice(Number(invoice.getGrandTotal()), false, tutao.locator.settingsViewModel.decimalSeparator());
    tutao.locator.modalDialogViewModel.showDialog([confirmMessage, priceMessage], ["invoicePay_action", "cancel_action"]).then(function(buttonIndex){
        if (buttonIndex == 0) {
            var service = new tutao.entity.sys.DebitServicePutData();
            service.setInvoice(invoice.getId());
            return service.update({},null).then(function(){
                invoice.setStatus(tutao.entity.tutanota.TutanotaConstants.INVOICE_STATUS_PAID);
            }).caught(tutao.PreconditionFailedError, function (error) {
                return tutao.locator.modalDialogViewModel.showAlert(tutao.lang("paymentProviderTransactionFailedError_msg")).then( function() {
                    tutao.locator.settingsViewModel.show(tutao.tutanota.ctrl.SettingsViewModel.DISPLAY_ADMIN_PAYMENT);
                });
            }).caught(tutao.BadGatewayError, function (error) {
                return tutao.locator.modalDialogViewModel.showAlert(tutao.lang("paymentProviderNotAvailableError_msg"));
            }).caught(tutao.TooManyRequestsError, function (error) {
                return tutao.locator.modalDialogViewModel.showAlert(tutao.lang("tooManyAttempts_msg"));
            });
        }
    }).lastly(function() {
        self._updatingInvoiceStatus(false);
    });
};
