from fastapi import APIRouter
from app.api.v1.admin.auth import router as auth_router
from app.api.v1.admin.properties import router as properties_router
from app.api.v1.admin.subscriptions import router as subscriptions_router
from app.api.v1.admin.plans import router as plans_router
from app.api.v1.admin.invoices import router as invoices_router
from app.api.v1.admin.payments import router as payments_router
from app.api.v1.admin.commissions import router as commissions_router
from app.api.v1.admin.audit import router as audit_router
from app.api.v1.admin.reports import router as reports_router

router = APIRouter(prefix="/admin")
router.include_router(auth_router)
router.include_router(properties_router)
router.include_router(subscriptions_router)
router.include_router(plans_router)
router.include_router(invoices_router)
router.include_router(payments_router)
router.include_router(commissions_router)
router.include_router(audit_router)
router.include_router(reports_router)
