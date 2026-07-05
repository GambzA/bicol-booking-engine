from fastapi import APIRouter
from app.api.v1.property.dashboard import router as dashboard_router
from app.api.v1.property.accommodations import router as accommodations_router
from app.api.v1.property.upload import router as upload_router
from app.api.v1.property.rate_plans import router as rate_plans_router
from app.api.v1.property.promotions import router as promotions_router
from app.api.v1.property.packages import router as packages_router
from app.api.v1.property.taxes import router as taxes_router
from app.api.v1.property.payment_methods import router as payment_methods_router
from app.api.v1.property.bookings import router as bookings_router
from app.api.v1.property.guests import router as guests_router

router = APIRouter(prefix="/property")
router.include_router(dashboard_router)
router.include_router(accommodations_router)
router.include_router(upload_router)
router.include_router(rate_plans_router)
router.include_router(promotions_router)
router.include_router(packages_router)
router.include_router(taxes_router)
router.include_router(payment_methods_router)
router.include_router(bookings_router)
router.include_router(guests_router)
