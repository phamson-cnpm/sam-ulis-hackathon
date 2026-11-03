
from fastapi import APIRouter

from api.v1.assets import router as assets_router
from api.v1.auth import router as auth_router
from api.v1.cases import router as cases_router
from api.v1.catalog import router as catalog_router
from api.v1.misc import router as misc_router
from api.v1.people import router as people_router
from api.v1.proposals import router as proposals_router
from api.v1.push import router as push_router
from api.v1.recalls import router as recalls_router

api_v1_router = APIRouter()
for r in (auth_router, misc_router, catalog_router, assets_router, cases_router, recalls_router, people_router, proposals_router, push_router):
    api_v1_router.include_router(r)
