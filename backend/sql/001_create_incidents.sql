
CREATE TABLE IF NOT EXISTS incidents (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,

    incident_type VARCHAR(50) NOT NULL,

    severity VARCHAR(20) NOT NULL DEFAULT 'medium'
        CHECK (severity IN ('low', 'medium', 'high', 'critical')),

    status VARCHAR(30) NOT NULL DEFAULT 'reported'
        CHECK (status IN (
            'reported',
            'investigating',
            'responding',
            'resolved',
            'closed'
        )),

    location TEXT NOT NULL,

    latitude DOUBLE PRECISION
        CHECK (latitude BETWEEN -90 AND 90),

    longitude DOUBLE PRECISION
        CHECK (longitude BETWEEN -180 AND 180),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incidents_status
    ON incidents(status);

CREATE INDEX IF NOT EXISTS idx_incidents_created_at
    ON incidents(created_at DESC);
