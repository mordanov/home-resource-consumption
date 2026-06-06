from fastapi import APIRouter

from app.api.v1.analytics import router as analytics_router
from app.api.v1.auth import router as auth_router
from app.api.v1.bills import router as bills_router
from app.api.v1.exports import router as exports_router
from app.api.v1.predictions import router as predictions_router

router = APIRouter()
router.include_router(auth_router)
router.include_router(bills_router)
router.include_router(predictions_router)
router.include_router(analytics_router)
router.include_router(exports_router)
