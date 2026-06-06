from enum import StrEnum


class ResourceType(StrEnum):
    ELECTRICITY = "ELECTRICITY"
    GAS = "GAS"
    WATER = "WATER"


class Unit(StrEnum):
    KWH = "KWH"
    CUBIC_METER = "CUBIC_METER"
