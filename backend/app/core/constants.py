class AuditAction:
    PROPERTY_CREATED = "property.created"
    PROPERTY_UPDATED = "property.updated"
    PROPERTY_SUSPENDED = "property.suspended"
    PROPERTY_REACTIVATED = "property.reactivated"
    PROPERTY_DEACTIVATED = "property.deactivated"

    SUBSCRIPTION_CREATED = "subscription.created"
    SUBSCRIPTION_UPDATED = "subscription.updated"
    SUBSCRIPTION_CANCELLED = "subscription.cancelled"

    PLAN_CREATED = "plan.created"
    PLAN_UPDATED = "plan.updated"
    PLAN_DISABLED = "plan.disabled"
    PLAN_TOGGLED = "plan.toggled"
    PLAN_DELETED = "plan.deleted"

    INVOICE_CREATED = "invoice.created"
    INVOICE_SENT = "invoice.sent"
    INVOICE_VOIDED = "invoice.voided"
    INVOICE_PAID = "invoice.paid"

    PAYMENT_RECORDED = "payment.recorded"

    PAYMENT_CREATED = "payment_record.created"
    PAYMENT_REFUNDED = "payment_record.refunded"

    CHARGE_ADDED = "booking_charge.added"
    CHARGE_ADJUSTED = "booking_charge.adjusted"

    INVENTORY_ADJUSTED = "inventory_adjustment.saved"
    INVENTORY_ADJUSTMENT_REMOVED = "inventory_adjustment.removed"

    COMMISSION_CALCULATED = "commission.calculated"
    COMMISSION_ADJUSTED = "commission.adjusted"
    COMMISSION_FINALIZED = "commission.finalized"

    ADMIN_LOGIN = "admin.login"
    ADMIN_LOGOUT = "admin.logout"

    OVERRIDE_PERFORMED = "override.performed"
    USER_CREATED = "user.created"
    USER_UPDATED = "user.updated"
    PASSWORD_RESET = "user.password_reset"
