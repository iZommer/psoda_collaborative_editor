--
-- PostgreSQL database dump
--

\restrict QKAdNxuEpNMWThglzTY5vDUxj7QK5LYniGdjTycvxLztB5TtPqCwckfbC4SeRi0

-- Dumped from database version 18.6 (Ubuntu 18.6-0ubuntu0.26.04.1)
-- Dumped by pg_dump version 18.6 (Ubuntu 18.6-0ubuntu0.26.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: psoda; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA psoda;


ALTER SCHEMA psoda OWNER TO postgres;

--
-- Name: on_update_current_timestamp_cursors(); Type: FUNCTION; Schema: psoda; Owner: postgres
--

CREATE FUNCTION psoda.on_update_current_timestamp_cursors() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$;


ALTER FUNCTION psoda.on_update_current_timestamp_cursors() OWNER TO postgres;

--
-- Name: on_update_current_timestamp_documents(); Type: FUNCTION; Schema: psoda; Owner: postgres
--

CREATE FUNCTION psoda.on_update_current_timestamp_documents() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$;


ALTER FUNCTION psoda.on_update_current_timestamp_documents() OWNER TO postgres;

--
-- Name: on_update_current_timestamp_users(); Type: FUNCTION; Schema: psoda; Owner: postgres
--

CREATE FUNCTION psoda.on_update_current_timestamp_users() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.last_seen_at = now();
   RETURN NEW;
END;
$$;


ALTER FUNCTION psoda.on_update_current_timestamp_users() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: cursors; Type: TABLE; Schema: psoda; Owner: postgres
--

CREATE TABLE psoda.cursors (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    document_id bigint NOT NULL,
    cursor_start bigint DEFAULT '0'::bigint NOT NULL,
    cursor_end bigint DEFAULT '0'::bigint NOT NULL,
    updated_at timestamp with time zone
);


ALTER TABLE psoda.cursors OWNER TO postgres;

--
-- Name: cursors_id_seq; Type: SEQUENCE; Schema: psoda; Owner: postgres
--

CREATE SEQUENCE psoda.cursors_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE psoda.cursors_id_seq OWNER TO postgres;

--
-- Name: cursors_id_seq; Type: SEQUENCE OWNED BY; Schema: psoda; Owner: postgres
--

ALTER SEQUENCE psoda.cursors_id_seq OWNED BY psoda.cursors.id;


--
-- Name: document_changes; Type: TABLE; Schema: psoda; Owner: postgres
--

CREATE TABLE psoda.document_changes (
    id bigint NOT NULL,
    document_id bigint NOT NULL,
    user_id bigint NOT NULL,
    base_version bigint NOT NULL,
    new_version bigint NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE psoda.document_changes OWNER TO postgres;

--
-- Name: document_changes_id_seq; Type: SEQUENCE; Schema: psoda; Owner: postgres
--

CREATE SEQUENCE psoda.document_changes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE psoda.document_changes_id_seq OWNER TO postgres;

--
-- Name: document_changes_id_seq; Type: SEQUENCE OWNED BY; Schema: psoda; Owner: postgres
--

ALTER SEQUENCE psoda.document_changes_id_seq OWNED BY psoda.document_changes.id;


--
-- Name: documents; Type: TABLE; Schema: psoda; Owner: postgres
--

CREATE TABLE psoda.documents (
    id bigint NOT NULL,
    title character varying(255) DEFAULT 'Untitled Document'::character varying NOT NULL,
    content text NOT NULL,
    version bigint DEFAULT '1'::bigint NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone
);


ALTER TABLE psoda.documents OWNER TO postgres;

--
-- Name: documents_id_seq; Type: SEQUENCE; Schema: psoda; Owner: postgres
--

CREATE SEQUENCE psoda.documents_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE psoda.documents_id_seq OWNER TO postgres;

--
-- Name: documents_id_seq; Type: SEQUENCE OWNED BY; Schema: psoda; Owner: postgres
--

ALTER SEQUENCE psoda.documents_id_seq OWNED BY psoda.documents.id;


--
-- Name: users; Type: TABLE; Schema: psoda; Owner: postgres
--

CREATE TABLE psoda.users (
    id bigint NOT NULL,
    name character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_seen_at timestamp with time zone
);


ALTER TABLE psoda.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: psoda; Owner: postgres
--

CREATE SEQUENCE psoda.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE psoda.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: psoda; Owner: postgres
--

ALTER SEQUENCE psoda.users_id_seq OWNED BY psoda.users.id;


--
-- Name: cursors id; Type: DEFAULT; Schema: psoda; Owner: postgres
--

ALTER TABLE ONLY psoda.cursors ALTER COLUMN id SET DEFAULT nextval('psoda.cursors_id_seq'::regclass);


--
-- Name: document_changes id; Type: DEFAULT; Schema: psoda; Owner: postgres
--

ALTER TABLE ONLY psoda.document_changes ALTER COLUMN id SET DEFAULT nextval('psoda.document_changes_id_seq'::regclass);


--
-- Name: documents id; Type: DEFAULT; Schema: psoda; Owner: postgres
--

ALTER TABLE ONLY psoda.documents ALTER COLUMN id SET DEFAULT nextval('psoda.documents_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: psoda; Owner: postgres
--

ALTER TABLE ONLY psoda.users ALTER COLUMN id SET DEFAULT nextval('psoda.users_id_seq'::regclass);


--
-- Data for Name: cursors; Type: TABLE DATA; Schema: psoda; Owner: postgres
--

COPY psoda.cursors (id, user_id, document_id, cursor_start, cursor_end, updated_at) FROM stdin;
\.


--
-- Data for Name: document_changes; Type: TABLE DATA; Schema: psoda; Owner: postgres
--

COPY psoda.document_changes (id, document_id, user_id, base_version, new_version, content, created_at) FROM stdin;
\.


--
-- Data for Name: documents; Type: TABLE DATA; Schema: psoda; Owner: postgres
--

COPY psoda.documents (id, title, content, version, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: psoda; Owner: postgres
--

COPY psoda.users (id, name, created_at, last_seen_at) FROM stdin;
\.


--
-- Name: cursors_id_seq; Type: SEQUENCE SET; Schema: psoda; Owner: postgres
--

SELECT pg_catalog.setval('psoda.cursors_id_seq', 1, true);


--
-- Name: document_changes_id_seq; Type: SEQUENCE SET; Schema: psoda; Owner: postgres
--

SELECT pg_catalog.setval('psoda.document_changes_id_seq', 1, true);


--
-- Name: documents_id_seq; Type: SEQUENCE SET; Schema: psoda; Owner: postgres
--

SELECT pg_catalog.setval('psoda.documents_id_seq', 1, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: psoda; Owner: postgres
--

SELECT pg_catalog.setval('psoda.users_id_seq', 1, true);


--
-- Name: cursors idx_16391_primary; Type: CONSTRAINT; Schema: psoda; Owner: postgres
--

ALTER TABLE ONLY psoda.cursors
    ADD CONSTRAINT idx_16391_primary PRIMARY KEY (id);


--
-- Name: documents idx_16403_primary; Type: CONSTRAINT; Schema: psoda; Owner: postgres
--

ALTER TABLE ONLY psoda.documents
    ADD CONSTRAINT idx_16403_primary PRIMARY KEY (id);


--
-- Name: document_changes idx_16418_primary; Type: CONSTRAINT; Schema: psoda; Owner: postgres
--

ALTER TABLE ONLY psoda.document_changes
    ADD CONSTRAINT idx_16418_primary PRIMARY KEY (id);


--
-- Name: users idx_16433_primary; Type: CONSTRAINT; Schema: psoda; Owner: postgres
--

ALTER TABLE ONLY psoda.users
    ADD CONSTRAINT idx_16433_primary PRIMARY KEY (id);


--
-- Name: idx_16391_fk_cursors_document; Type: INDEX; Schema: psoda; Owner: postgres
--

CREATE INDEX idx_16391_fk_cursors_document ON psoda.cursors USING btree (document_id);


--
-- Name: idx_16391_unique_user_document_cursor; Type: INDEX; Schema: psoda; Owner: postgres
--

CREATE UNIQUE INDEX idx_16391_unique_user_document_cursor ON psoda.cursors USING btree (user_id, document_id);


--
-- Name: idx_16418_fk_changes_document; Type: INDEX; Schema: psoda; Owner: postgres
--

CREATE INDEX idx_16418_fk_changes_document ON psoda.document_changes USING btree (document_id);


--
-- Name: idx_16418_fk_changes_user; Type: INDEX; Schema: psoda; Owner: postgres
--

CREATE INDEX idx_16418_fk_changes_user ON psoda.document_changes USING btree (user_id);


--
-- Name: cursors on_update_current_timestamp; Type: TRIGGER; Schema: psoda; Owner: postgres
--

CREATE TRIGGER on_update_current_timestamp BEFORE UPDATE ON psoda.cursors FOR EACH ROW EXECUTE FUNCTION psoda.on_update_current_timestamp_cursors();


--
-- Name: documents on_update_current_timestamp; Type: TRIGGER; Schema: psoda; Owner: postgres
--

CREATE TRIGGER on_update_current_timestamp BEFORE UPDATE ON psoda.documents FOR EACH ROW EXECUTE FUNCTION psoda.on_update_current_timestamp_documents();


--
-- Name: users on_update_current_timestamp; Type: TRIGGER; Schema: psoda; Owner: postgres
--

CREATE TRIGGER on_update_current_timestamp BEFORE UPDATE ON psoda.users FOR EACH ROW EXECUTE FUNCTION psoda.on_update_current_timestamp_users();


--
-- Name: document_changes fk_changes_document; Type: FK CONSTRAINT; Schema: psoda; Owner: postgres
--

ALTER TABLE ONLY psoda.document_changes
    ADD CONSTRAINT fk_changes_document FOREIGN KEY (document_id) REFERENCES psoda.documents(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: document_changes fk_changes_user; Type: FK CONSTRAINT; Schema: psoda; Owner: postgres
--

ALTER TABLE ONLY psoda.document_changes
    ADD CONSTRAINT fk_changes_user FOREIGN KEY (user_id) REFERENCES psoda.users(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: cursors fk_cursors_document; Type: FK CONSTRAINT; Schema: psoda; Owner: postgres
--

ALTER TABLE ONLY psoda.cursors
    ADD CONSTRAINT fk_cursors_document FOREIGN KEY (document_id) REFERENCES psoda.documents(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- Name: cursors fk_cursors_user; Type: FK CONSTRAINT; Schema: psoda; Owner: postgres
--

ALTER TABLE ONLY psoda.cursors
    ADD CONSTRAINT fk_cursors_user FOREIGN KEY (user_id) REFERENCES psoda.users(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict QKAdNxuEpNMWThglzTY5vDUxj7QK5LYniGdjTycvxLztB5TtPqCwckfbC4SeRi0

